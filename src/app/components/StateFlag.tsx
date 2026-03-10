import { USStateFlags } from "us-state-flags";

type Size = "sm" | "md";

const dimensions: Record<Size, { width: number; height: number }> = {
  sm: { width: 16, height: 11 },
  md: { width: 24, height: 16 },
};

export function StateFlag({
  abbrev,
  size = "sm",
}: {
  abbrev: string;
  size?: Size;
}) {
  const { width, height } = dimensions[size];
  const flagSize = size === "sm" ? "xs" : "sm";
  const scale = size === "md" ? width / 36 : 1; // sm flag is 36px wide

  return (
    <span
      className="inline-flex items-center justify-center overflow-hidden rounded-sm flex-shrink-0"
      style={{ width, height, position: "relative" }}
      aria-hidden
    >
      {scale === 1 ? (
        <USStateFlags
          state={abbrev}
          showFlag
          showName={false}
          showAbbreviation={false}
          showCapital={false}
          flagSize={flagSize}
          style={{ margin: 0, display: "block" }}
        />
      ) : (
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 36,
            height: 24,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <USStateFlags
            state={abbrev}
            showFlag
            showName={false}
            showAbbreviation={false}
            showCapital={false}
            flagSize={flagSize}
            style={{ margin: 0, display: "block" }}
          />
        </span>
      )}
    </span>
  );
}
