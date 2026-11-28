import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "@phosphor-icons/react";

import { useAuth } from "../auth/AuthContext.jsx";
import "./ai-feedback.css";

/**
 * Helpful / not helpful on one AI output. Ratings feed the per-feature quality numbers UIT sees;
 * clicking again changes the vote. Failures are silent: rating is never in the user's way.
 */
export function AiFeedback({ feature, subjectId, modelVersion, question = "Gợi ý này có hữu ích không?" }) {
  const { authorizedRequest } = useAuth();
  const [vote, setVote] = useState(null);
  if (!feature || !subjectId) return null;

  const send = (helpful) => {
    setVote(helpful);
    authorizedRequest("/ai/feedback", { method: "POST", body: JSON.stringify({ feature, subjectId, helpful, modelVersion }) })
      .catch(() => setVote(null));
  };

  return <div className="ai-feedback" role="group" aria-label={question}>
    <span>{vote === null ? question : "Cảm ơn bạn đã đánh giá."}</span>
    <button type="button" aria-pressed={vote === true} aria-label="Hữu ích" className={vote === true ? "on" : ""} onClick={() => send(true)}><ThumbsUp weight={vote === true ? "fill" : "regular"} /></button>
    <button type="button" aria-pressed={vote === false} aria-label="Không hữu ích" className={vote === false ? "on" : ""} onClick={() => send(false)}><ThumbsDown weight={vote === false ? "fill" : "regular"} /></button>
  </div>;
}
