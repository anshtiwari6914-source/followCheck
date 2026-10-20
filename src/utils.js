
import JSZip from "jszip";

function normalizeUsername(username) {
  return String(username)
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
}

function uniqueUsernames(usernames) {
  const unique = new Map();

  for (const username of usernames) {
    if (typeof username !== "string") continue;

    const cleaned = username.trim().replace(/^@/, "");
    if (!cleaned) continue;

    const key = normalizeUsername(cleaned);

    if (!unique.has(key)) {
      unique.set(key, cleaned);
    }
  }

  return [...unique.values()];
}

function usernameFromUrl(href) {
  try {
    const url = new URL(href);

    if (!/(^|\.)instagram\.com$/i.test(url.hostname)) {
      return null;
    }

    const parts = url.pathname
      .split("/")
      .filter(Boolean)
      .map(part => decodeURIComponent(part));

    // Instagram export URLs can look like /_u/username/
    if (parts[0]?.toLowerCase() === "_u") {
      return parts[1] || null;
    }

    // They can also use /username/
    return parts[0] || null;
  } catch {
    return null;
  }
}

function extractUsernames(data) {
  const usernames = [];

  function visit(value) {
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }

    if (!value || typeof value !== "object") {
      return;
    }

    const entries = value.string_list_data;

    if (Array.isArray(entries)) {
      let username = null;

      // Prefer the explicit username when Instagram provides it.
      for (const entry of entries) {
        if (
          typeof entry?.value === "string" &&
          entry.value.trim()
        ) {
          username = entry.value.trim();
          break;
        }
      }

      // Some exports store the username in the entry's title.
      if (
        !username &&
        typeof value.title === "string" &&
        value.title.trim()
      ) {
        username = value.title.trim();
      }

      // Otherwise, extract it from the Instagram profile URL.
      if (!username) {
        for (const entry of entries) {
          if (typeof entry?.href !== "string") continue;

          username = usernameFromUrl(entry.href);

          if (username) break;
        }
      }

      if (username) {
        usernames.push(username);
        return;
      }
    }

    // Continue through nested objects and arrays.
    for (const [key, child] of Object.entries(value)) {
      if (key === "string_list_data" || key === "title") {
        continue;
      }

      visit(child);
    }
  }

  visit(data);

  return uniqueUsernames(usernames);
}

export async function importInstagramZip(file) {
  const zip = await JSZip.loadAsync(file);

  const paths = Object.keys(zip.files);

  const followerFiles = paths.filter(
    path =>
      /(^|\/)followers(?:_\d+)?\.json$/i.test(path) &&
      !zip.files[path].dir
  );

  const followingPath = paths.find(
    path =>
      /(^|\/)following\.json$/i.test(path) &&
      !zip.files[path].dir
  );

  if (followerFiles.length === 0) {
    throw new Error(
      "Couldn't find followers JSON files. Please upload your Instagram data export ZIP."
    );
  }

  if (!followingPath) {
    throw new Error(
      "Couldn't find following.json in your Instagram export ZIP."
    );
  }

  const allFollowers = [];

  for (const path of followerFiles) {
    let json;

    try {
      const content = await zip.files[path].async("string");
      json = JSON.parse(content);
    } catch {
      throw new Error(
        `Couldn't read ${path}. The JSON file may be invalid.`
      );
    }

    allFollowers.push(...extractUsernames(json));
  }

  let followingJson;

  try {
    const content = await zip.files[followingPath].async("string");
    followingJson = JSON.parse(content);
  } catch {
    throw new Error(
      "Couldn't read following.json. The file may be invalid."
    );
  }

  const followers = uniqueUsernames(allFollowers);
  const following = extractUsernames(followingJson);

  if (followers.length === 0 && following.length === 0) {
    throw new Error(
      "No usernames were found. Check that you uploaded the correct Instagram export."
    );
  }

  return { followers, following };
}

export function compareFollowers(followers, following) {
  const followerSet = new Set(
    followers.map(normalizeUsername)
  );

  const followingSet = new Set(
    following.map(normalizeUsername)
  );

  return {
    notFollowingBack: following.filter(
      username => !followerSet.has(normalizeUsername(username))
    ),

    mutuals: following.filter(
      username => followerSet.has(normalizeUsername(username))
    ),

    fans: followers.filter(
      username => !followingSet.has(normalizeUsername(username))
    ),
  };
}
