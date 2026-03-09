import type { Church } from "./church-data";
import { DENOMINATION_GROUPS } from "./church-data";
import type { SuggestionConsensus } from "./api";
import { fetchSuggestions, submitSuggestion } from "./api";
import {
  X,
  Send,
  Check,
  Users,
  Globe,
  MapPin,
  Church as ChurchIcon,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";

interface SuggestEditFormProps {
  church: Church;
  onClose: () => void;
}

type EditableField = "website" | "address" | "attendance" | "denomination";

const FIELD_CONFIG: {
  key: EditableField;
  label: string;
  icon: typeof Globe;
  placeholder: string;
  type: "text" | "number" | "select";
}[] = [
  {
    key: "website",
    label: "Website",
    icon: Globe,
    placeholder: "https://www.example.com",
    type: "text",
  },
  {
    key: "address",
    label: "Address",
    icon: MapPin,
    placeholder: "123 Main St, City, State",
    type: "text",
  },
  {
    key: "attendance",
    label: "Weekly Attendance",
    icon: Users,
    placeholder: "Enter estimated weekly attendance",
    type: "number",
  },
  {
    key: "denomination",
    label: "Denomination",
    icon: ChurchIcon,
    placeholder: "Select denomination",
    type: "select",
  },
];

function VoteProgress({
  consensus,
}: {
  consensus: SuggestionConsensus | undefined;
}) {
  if (!consensus || consensus.votes === 0) return null;
  const { votes, needed, approved, submissions } = consensus;

  return (
    <div className="mt-2 space-y-1.5">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min((votes / needed) * 100, 100)}%`,
              backgroundColor: approved ? "#22c55e" : "#a855f7",
            }}
          />
        </div>
        <span className="text-[10px] text-white/50 font-medium tabular-nums">
          {votes}/{needed}
        </span>
      </div>

      {/* Submission breakdown */}
      {submissions.length > 0 && (
        <div className="space-y-1">
          {submissions.slice(0, 3).map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 text-[10px]"
            >
              <span className="text-white/40 truncate flex-1 min-w-0">
                "{s.value}"
              </span>
              <span className="text-white/30 flex-shrink-0">
                {s.count} {s.count === 1 ? "vote" : "votes"}
              </span>
            </div>
          ))}
        </div>
      )}

      {approved && (
        <div className="flex items-center gap-1 text-[10px] text-green-400/80">
          <Check size={10} />
          <span>Approved by community consensus</span>
        </div>
      )}
    </div>
  );
}

export function SuggestEditForm({ church, onClose }: SuggestEditFormProps) {
  const [consensus, setConsensus] = useState<Record<
    string,
    SuggestionConsensus
  > | null>(null);
  const [myVotes, setMyVotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({
    website: church.website || "",
    address: [church.address, church.city, church.state]
      .filter(Boolean)
      .join(", "),
    attendance: String(church.attendance),
    denomination: church.denomination,
  });

  const loadSuggestions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchSuggestions(church.id);
      setConsensus(data.consensus);
      setMyVotes(data.myVotes);
    } catch (err) {
      console.error("Failed to load suggestions:", err);
    } finally {
      setLoading(false);
    }
  }, [church.id]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const handleSubmit = async (field: EditableField) => {
    const value = values[field]?.trim();
    if (!value) return;

    setSubmitting(field);
    setError(null);

    try {
      const result = await submitSuggestion(church.id, field, value);
      if (result.allFields) {
        setConsensus(result.allFields);
      }
      setSubmitted((prev) => new Set([...prev, field]));
      setMyVotes((prev) => ({ ...prev, [field]: value }));

      // Clear the submitted indicator after 2s
      setTimeout(() => {
        setSubmitted((prev) => {
          const next = new Set(prev);
          next.delete(field);
          return next;
        });
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to submit suggestion");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{
        backgroundColor: "#1E1040",
        fontFamily: "'Livvic', sans-serif",
      }}
    >
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Users size={10} className="text-purple-400" />
              </div>
              <span className="text-[10px] uppercase tracking-wider text-purple-400/70 font-semibold">
                Community Corrections
              </span>
            </div>
            <h2 className="text-white font-bold text-base leading-tight truncate">
              {church.name}
            </h2>
            <p className="text-white/40 text-[11px] mt-1.5 leading-relaxed">
              Suggest corrections below. Changes are applied when{" "}
              <span className="text-purple-400 font-semibold">3 people</span>{" "}
              agree on the same value.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <X size={18} className="text-white/60" />
          </button>
        </div>
      </div>

      {/* Form fields */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="text-purple-400 animate-spin" />
          </div>
        ) : (
          <>
            {FIELD_CONFIG.map(({ key, label, icon: Icon, placeholder, type }) => {
              const fieldConsensus = consensus?.[key];
              const hasVoted = !!myVotes[key];
              const isSubmitting = submitting === key;
              const justSubmitted = submitted.has(key);

              return (
                <div
                  key={key}
                  className="rounded-xl p-3.5 bg-white/5 border border-white/5"
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <Icon size={13} className="text-purple-400" />
                    <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                      {label}
                    </span>
                    {fieldConsensus?.approved && (
                      <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400 font-semibold">
                        APPROVED
                      </span>
                    )}
                    {hasVoted && !fieldConsensus?.approved && (
                      <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-semibold">
                        VOTED
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {type === "select" ? (
                      <select
                        value={values[key]}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [key]: e.target.value }))
                        }
                        className="flex-1 bg-white/8 rounded-lg px-3 py-2 text-white text-xs border border-white/10 focus:border-purple-500/50 focus:outline-none transition-colors appearance-none"
                      >
                        <option value="" className="bg-[#1E1040]">
                          Select...
                        </option>
                        {DENOMINATION_GROUPS.filter(
                          (g) => g.label !== "Other"
                        ).map((g) => (
                          <option
                            key={g.label}
                            value={g.label}
                            className="bg-[#1E1040]"
                          >
                            {g.label}
                          </option>
                        ))}
                        <option value="Unknown" className="bg-[#1E1040]">
                          Unknown / Other
                        </option>
                      </select>
                    ) : (
                      <input
                        type={type}
                        value={values[key]}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [key]: e.target.value }))
                        }
                        placeholder={placeholder}
                        min={type === "number" ? 1 : undefined}
                        max={type === "number" ? 50000 : undefined}
                        className="flex-1 bg-white/8 rounded-lg px-3 py-2 text-white text-xs border border-white/10 focus:border-purple-500/50 focus:outline-none transition-colors placeholder:text-white/20"
                      />
                    )}
                    <button
                      onClick={() => handleSubmit(key)}
                      disabled={
                        isSubmitting ||
                        !values[key]?.trim() ||
                        justSubmitted
                      }
                      className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
                      style={{
                        backgroundColor: justSubmitted
                          ? "rgba(34, 197, 94, 0.3)"
                          : "rgba(168, 85, 247, 0.3)",
                      }}
                    >
                      {isSubmitting ? (
                        <Loader2
                          size={14}
                          className="text-purple-300 animate-spin"
                        />
                      ) : justSubmitted ? (
                        <Check size={14} className="text-green-400" />
                      ) : (
                        <Send size={14} className="text-purple-300" />
                      )}
                    </button>
                  </div>

                  <VoteProgress consensus={fieldConsensus} />
                </div>
              );
            })}

            {error && (
              <div className="flex items-center gap-2 rounded-lg p-3 bg-red-500/10 border border-red-500/20">
                <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                <p className="text-red-300/80 text-xs">{error}</p>
              </div>
            )}
          </>
        )}

        {/* Info note */}
        <div className="pt-3 border-t border-white/5">
          <p className="text-white/25 text-[10px] leading-relaxed text-center">
            Corrections require 3 independent votes to take effect. For
            attendance, the approved value is the average of all votes. Your
            vote can be updated once per day.
          </p>
        </div>
      </div>
    </div>
  );
}
