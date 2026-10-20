
import { useMemo, useRef, useState } from "react";
import {
  Users,
  UserRoundX,
  UserRoundCheck,
  Upload,
  Search,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  X,
  Undo2,
} from "lucide-react";

import {
  importInstagramZip,
  compareFollowers,
} from "./utils.js";

const sampleData = {
  followers: ["rahul", "aman", "priya", "neha", "riya"],
  following: ["rahul", "priya", "neha", "karan", "rohan"],
};

const tabs = [
  { id: "notFollowingBack", label: "Not following back" },
  { id: "mutuals", label: "Mutuals" },
  { id: "fans", label: "Fans" },
  { id: "followers", label: "Followers" },
  { id: "following", label: "Following" },
];

function normalizeUsername(username) {
  return String(username).trim().replace(/^@/, "").toLowerCase();
}

export default function App() {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("notFollowingBack");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Corrections apply only to this browser session.
  const [unavailable, setUnavailable] = useState([]);
  const [pendingUsername, setPendingUsername] = useState(null);
  const [confirmations, setConfirmations] = useState([false, false, false]);

  const fileRef = useRef(null);

  const correctedData = useMemo(() => {
    if (!data) return null;

    const excluded = new Set(unavailable);

    return {
      followers: data.followers.filter(
        (name) => !excluded.has(normalizeUsername(name))
      ),
      following: data.following.filter(
        (name) => !excluded.has(normalizeUsername(name))
      ),
    };
  }, [data, unavailable]);

  const results = useMemo(() => {
    if (!correctedData) {
      return {
        notFollowingBack: [],
        mutuals: [],
        fans: [],
        followers: [],
        following: [],
      };
    }

    return {
      ...compareFollowers(
        correctedData.followers,
        correctedData.following
      ),
      followers: correctedData.followers,
      following: correctedData.following,
    };
  }, [correctedData]);

  const activeList = (results[activeTab] || []).filter((username) =>
    normalizeUsername(username).includes(normalizeUsername(search))
  );

  async function loadFile(file) {
    if (!file) return;

    setLoading(true);
    setMessage("");

    try {
      const imported = await importInstagramZip(file);

      if (
        !Array.isArray(imported.followers) ||
        !Array.isArray(imported.following)
      ) {
        throw new Error(
          "The ZIP didn't contain valid follower and following lists."
        );
      }

      setData({
        followers: imported.followers,
        following: imported.following,
      });

      setUnavailable([]);
      setPendingUsername(null);
      setConfirmations([false, false, false]);
      setActiveTab("notFollowingBack");
      setSearch("");

      setMessage(
        "Import successful! Results are based on your uploaded export and may not reflect your current Instagram account."
      );
    } catch (error) {
      console.error("Instagram ZIP import failed:", error);
      setMessage(
        error.message ||
          "Couldn't read this file. Please try another export."
      );
    } finally {
      setLoading(false);

      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  }

  function loadSample() {
    setData(sampleData);
    setUnavailable([]);
    setPendingUsername(null);
    setConfirmations([false, false, false]);
    setActiveTab("notFollowingBack");
    setSearch("");
    setMessage(
      "Demo data loaded. These are example accounts, not real results."
    );
  }

  function openUnavailableDialog(username) {
    setPendingUsername(username);
    setConfirmations([false, false, false]);
  }

  function closeUnavailableDialog() {
    setPendingUsername(null);
    setConfirmations([false, false, false]);
  }

  function confirmUnavailable() {
    if (!pendingUsername || !confirmations.every(Boolean)) return;

    const key = normalizeUsername(pendingUsername);

    setUnavailable((previous) =>
      previous.includes(key) ? previous : [...previous, key]
    );

    setMessage(
      `@${pendingUsername} was excluded from your results. You can undo this correction below.`
    );

    closeUnavailableDialog();
  }

  function undoCorrection(username) {
    const key = normalizeUsername(username);

    setUnavailable((previous) =>
      previous.filter((name) => name !== key)
    );

    setMessage(`Correction undone for @${username}.`);
  }

  function getAccountDescription() {
    switch (activeTab) {
      case "notFollowingBack":
        return "You follow this account, but it isn't listed among your followers.";
      case "mutuals":
        return "You follow each other according to the export.";
      case "fans":
        return "Follows you, but you don't follow back.";
      case "followers":
        return "This account appears in your exported followers list.";
      case "following":
        return "This account appears in your exported following list.";
      default:
        return "";
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home">
          <span className="brand-icon">
            <Users size={22} />
          </span>
          <span>FollowCheck</span>
        </a>

        <span className="privacy-label">
          <ShieldCheck size={16} />
          Local processing
        </span>
      </header>

      <section className="hero" id="home">
        <div className="eyebrow">YOUR FOLLOWING, SIMPLIFIED</div>

        <h1>
          Know your <span>Instagram circle.</span>
        </h1>

        <p>
          Compare followers and following, find non-mutuals, and
          discover who follows you that you don't follow back.
        </p>

        <div className="upload-panel">
          <div className="upload-icon">
            <Upload size={24} />
          </div>

          <h2>Import your Instagram data</h2>

          <p>
            Choose the ZIP file from your Instagram data export.
            Your file is processed in this browser.
          </p>

          <div className="accuracy-disclaimer" role="note">
            <ShieldCheck size={20} />
            <div>
              <strong>Important: Results may not be fully accurate</strong>
              <p>
                FollowCheck analyzes the Instagram data export you upload.
                It may be outdated or incomplete and is not a live Instagram
                connection.
              </p>
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(event) => loadFile(event.target.files?.[0])}
          />

          <button
            className="primary-button"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
          >
            {loading ? "Analyzing..." : "Upload Instagram ZIP"}
          </button>

          <button className="text-button" onClick={loadSample}>
            Try demo with sample data
          </button>

          {message && (
            <div className="message" role="status">
              {message}
            </div>
          )}
        </div>
      </section>

      {data && correctedData && (
        <section className="dashboard">
          <div className="section-heading">
            <div>
              <div className="eyebrow">YOUR OVERVIEW</div>
              <h2>Account insights</h2>
            </div>

            <button
              className="icon-button"
              onClick={() => fileRef.current?.click()}
              title="Import another ZIP"
              disabled={loading}
            >
              <RefreshCw size={17} />
            </button>
          </div>

          <div className="stats-grid">
            <StatCard
              icon={<Users />}
              label="Followers"
              value={correctedData.followers.length}
            />

            <StatCard
              icon={<UserRoundCheck />}
              label="Following"
              value={correctedData.following.length}
            />

            <StatCard
              icon={<UserRoundX />}
              label="Don't follow back"
              value={results.notFollowingBack.length}
            />
          </div>

          {unavailable.length > 0 && (
            <div className="corrections-panel">
              <div className="corrections-heading">
                <div>
                  <strong>Manual corrections</strong>
                  <p>
                    {unavailable.length} account
                    {unavailable.length === 1 ? "" : "s"} excluded from
                    the displayed results.
                  </p>
                </div>
                <Undo2 size={20} />
              </div>

              <div className="correction-list">
                {unavailable.map((username) => (
                  <div className="correction-row" key={username}>
                    <span>@{username}</span>
                    <button
                      className="text-button"
                      onClick={() => undoCorrection(username)}
                    >
                      Undo
                    </button>
                  </div>
                ))}
              </div>

              <p className="correction-note">
                These are your manual corrections, not verified deletions.
                Your imported data has not been changed.
              </p>
            </div>
          )}

          <div className="results-panel">
            <div className="tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`tab ${
                    activeTab === tab.id ? "active" : ""
                  }`}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSearch("");
                  }}
                >
                  {tab.label}
                  <span>{results[tab.id].length}</span>
                </button>
              ))}
            </div>

            <div className="list-toolbar">
              <div>
                <h3>
                  {tabs.find((tab) => tab.id === activeTab)?.label}
                </h3>
                <p>
                  {activeList.length} account
                  {activeList.length === 1 ? "" : "s"}
                </p>
              </div>

              <label className="search-box">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search usernames"
                />
              </label>
            </div>

            {activeList.length === 0 ? (
              <div className="empty-state">
                <Users size={30} />
                <h3>No accounts found</h3>
                <p>Try another username or switch tabs.</p>
              </div>
            ) : (
              <div className="user-list">
                {activeList.map((username) => (
                  <div className="user-row" key={username}>
                    <div className="avatar">
                      {username.charAt(0).toUpperCase()}
                    </div>

                    <div className="user-info">
                      <strong>@{username}</strong>
                      <span>{getAccountDescription()}</span>
                    </div>

                    <div className="user-actions">
                      <a
                        className="profile-link"
                        href={`https://www.instagram.com/${encodeURIComponent(
                          username
                        )}/`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </a>

                      <button
                        className="unavailable-button"
                        onClick={() => openUnavailableDialog(username)}
                        title="Review and exclude this account"
                      >
                        Mark unavailable
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="accuracy-disclaimer results-disclaimer" role="note">
              <ShieldCheck size={20} />
              <div>
                <strong>
                  Can't find a profile or the result looks wrong?
                </strong>
                <p>
                  The person may have changed their username, or the account
                  may be temporarily unavailable. Before marking an account
                  unavailable, check the Instagram login, search for the
                  username in both Followers and Following, and retry the
                  profile. FollowCheck cannot verify profile availability
                  automatically.
                </p>
              </div>
            </div>

            <div className="privacy-footer">
              <ShieldCheck size={16} />
              Results are calculated in your browser from your uploaded data.
              FollowCheck does not provide a live Instagram connection.
            </div>
          </div>
        </section>
      )}

      {pendingUsername && (
        <div
          className="unavailable-overlay"
          onClick={closeUnavailableDialog}
        >
          <section
            className="unavailable-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="unavailable-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={closeUnavailableDialog}
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>

            <div className="modal-icon">
              <AlertTriangle size={26} />
            </div>

            <h2 id="unavailable-title">Before marking unavailable</h2>

            <p className="modal-intro">
              You're about to exclude <strong>@{pendingUsername}</strong>{" "}
              from your displayed results. Please check the following first.
            </p>

            <div className="confirmation-checks">
              {[
                "I'm logged into the same Instagram account used for this export.",
                "I've checked whether this person changed their username.",
                "I've retried the profile and it still appears unavailable.",
              ].map((label, index) => (
                <label className="confirmation-check" key={label}>
                  <input
                    type="checkbox"
                    checked={confirmations[index]}
                    onChange={(event) => {
                      setConfirmations((previous) =>
                        previous.map((value, i) =>
                          i === index ? event.target.checked : value
                        )
                      );
                    }}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <p className="modal-disclaimer">
              FollowCheck cannot verify your Instagram login or confirm that
              a profile no longer exists. This correction is based on your
              judgement and can be undone.
            </p>

            <div className="modal-actions">
              <button
                className="text-button"
                onClick={closeUnavailableDialog}
              >
                Cancel
              </button>

              <button
                className="primary-button"
                disabled={!confirmations.every(Boolean)}
                onClick={confirmUnavailable}
              >
                Confirm and exclude
              </button>
            </div>
          </section>
        </div>
      )}

      <footer className="footer">
        <strong>FollowCheck</strong>
        <span>
          Independent project · Not affiliated with Instagram or Meta
        </span>
      </footer>
    </main>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className="stat-icon">{icon}</span>
        <span>{label}</span>
      </div>
      <strong className="stat-value">{value}</strong>
    </div>
  );
}
