/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

export function QuantityControl({ countId, lineId, productTitle, quantity }) {
  const fetcher = useFetcher();
  const [value, setValue] = useState(String(quantity));
  const lastSubmittedValue = useRef(null);
  const busy = fetcher.state !== "idle";

  useEffect(() => {
    setValue(String(quantity));
    lastSubmittedValue.current = null;
  }, [quantity]);

  function submit(intent, submittedQuantity) {
    if (busy) return;
    fetcher.submit(
      {
        intent,
        countId,
        lineId,
        ...(submittedQuantity !== undefined
          ? { quantity: submittedQuantity }
          : {}),
      },
      { method: "post" },
    );
  }

  function saveDirectEntry() {
    if (
      value !== String(quantity) &&
      value !== lastSubmittedValue.current
    ) {
      lastSubmittedValue.current = value;
      submit("set-line-quantity", value);
    }
  }

  useEffect(() => {
    if (busy || value === "" || value === String(quantity)) return undefined;
    const timer = setTimeout(saveDirectEntry, 450);
    return () => clearTimeout(timer);
    // saveDirectEntry intentionally uses the latest render values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, quantity, value]);

  return (
    <div>
      <input
        aria-label={`Counted quantity for ${productTitle}`}
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        value={value}
        disabled={busy}
        onChange={(event) => setValue(event.target.value)}
        onBlur={saveDirectEntry}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            saveDirectEntry();
          }
        }}
        style={{ width: 64, textAlign: "right" }}
      />
      {fetcher.data?.error && (
        <small style={{ color: "#b42318", whiteSpace: "normal" }}>
          {fetcher.data.error}
        </small>
      )}
    </div>
  );
}
