/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";
import {
  exactBarcodeMatches,
  searchInventoryCountLines,
} from "../utils/inventory-count-search";
import styles from "./scan-or-search-input.module.css";

const RESULT_LIMIT = 10;

export function ScanOrSearchInput({
  countId,
  lines,
  scanningDisabled,
  onLocateLine,
  allowUnknownBarcode = false,
}) {
  const fetcher = useFetcher();
  const inputRef = useRef(null);
  const currentBarcode = useRef(null);
  const requestWasBusy = useRef(false);
  const [value, setValue] = useState("");
  const [queue, setQueue] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [result, setResult] = useState(null);
  const matches = useMemo(
    () => searchInventoryCountLines(lines, value),
    [lines, value],
  );
  const visibleMatches = matches.slice(0, RESULT_LIMIT);
  const listboxId = "scan-or-search-results";
  const focusInput = useCallback(() => {
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    focusInput();
  }, [focusInput]);

  useEffect(() => {
    if (fetcher.state !== "idle") {
      requestWasBusy.current = true;
      return;
    }
    if (!requestWasBusy.current || !currentBarcode.current) return;
    requestWasBusy.current = false;
    const submittedBarcode = currentBarcode.current;
    currentBarcode.current = null;
    if (fetcher.data?.scan?.line) {
      const line = fetcher.data.scan.line;
      setResult({
        tone: "success",
        message: `${line.productTitle}${line.variantTitle ? ` — ${line.variantTitle}` : ""} — Count: ${line.countedQuantity}`,
      });
      onLocateLine(line.id);
    } else if (fetcher.data?.scan?.duplicate) {
      setResult({
        tone: "critical",
        message: fetcher.data.scan.message,
        barcode: submittedBarcode,
        matchingProducts: fetcher.data.scan.matchingProducts,
      });
    } else {
      setResult({
        tone: "critical",
        message: fetcher.data?.error || "The barcode could not be processed.",
        barcode: submittedBarcode,
        matchingProducts: fetcher.data?.matchingProducts,
      });
    }
    setValue("");
    setOpen(false);
    setActiveIndex(-1);
    focusInput();
  }, [fetcher.data, fetcher.state, focusInput, onLocateLine]);

  useEffect(() => {
    if (
      scanningDisabled ||
      fetcher.state !== "idle" ||
      currentBarcode.current ||
      queue.length === 0
    )
      return;
    const [barcode, ...remaining] = queue;
    currentBarcode.current = barcode;
    setQueue(remaining);
    fetcher.submit(
      { intent: "scan-barcode", countId, barcode },
      { method: "post" },
    );
  }, [countId, fetcher, fetcher.state, queue, scanningDisabled]);

  function selectLine(line) {
    setValue("");
    setOpen(false);
    setActiveIndex(-1);
    setResult(null);
    onLocateLine(line.id);
    focusInput();
  }

  function handleSubmit(event) {
    event.preventDefault();
    const query = value.trim();
    if (!query) return;
    const barcodeMatches = exactBarcodeMatches(lines, query);
    if (barcodeMatches.length > 0 || allowUnknownBarcode) {
      if (scanningDisabled) {
        setResult({
          tone: "critical",
          message: "Finish or cancel product selection before scanning.",
        });
        return;
      }
      setValue("");
      setOpen(false);
      setActiveIndex(-1);
      setQueue((current) => [...current, query]);
      return;
    }
    if (activeIndex >= 0 && visibleMatches[activeIndex]) {
      selectLine(visibleMatches[activeIndex]);
    } else {
      setOpen(true);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown" && visibleMatches.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        Math.min(current + 1, visibleMatches.length - 1),
      );
    } else if (event.key === "ArrowUp" && visibleMatches.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className={styles.scanner}>
      <form onSubmit={handleSubmit}>
        <label className={styles.label} htmlFor="scan-or-search-input">
          Scan or Search
        </label>
        <input
          ref={inputRef}
          id="scan-or-search-input"
          className={styles.input}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && value.trim().length > 0}
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0
              ? `scan-search-option-${visibleMatches[activeIndex]?.id}`
              : undefined
          }
          value={value}
          placeholder="Scan barcode or search product, SKU, or barcode"
          autoComplete="off"
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(event.target.value.trim().length > 0);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
        />
      </form>

      {open && value.trim() && (
        <div
          id={listboxId}
          className={styles.results}
          role="listbox"
          aria-label="Products in this count"
        >
          {visibleMatches.map((line, index) => (
            <button
              id={`scan-search-option-${line.id}`}
              key={line.id}
              className={`${styles.option} ${index === activeIndex ? styles.activeOption : ""}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectLine(line)}
            >
              <strong>
                {line.productTitle}
                {line.variantTitle ? ` — ${line.variantTitle}` : ""}
              </strong>
              <span>
                SKU: {line.sku || "—"} · Barcode: {line.barcode || "—"}
              </span>
              <span>
                Expected: {line.startingQuantity ?? 0} · Counted:{" "}
                {line.countedQuantity}
              </span>
            </button>
          ))}
          {matches.length > RESULT_LIMIT && (
            <div className={styles.matchCount}>
              {RESULT_LIMIT} of {matches.length} matches
            </div>
          )}
          {matches.length === 0 && (
            <div className={styles.empty}>
              <span>
                No products in this count match &quot;{value.trim()}&quot;.
              </span>
              <s-button href="#add-product">Add Product</s-button>
            </div>
          )}
        </div>
      )}

      {scanningDisabled && (
        <s-banner tone="warning">
          Barcode increments are disabled during product selection. Manual
          search remains available.
        </s-banner>
      )}
      {result && (
        <div aria-live={result.tone === "success" ? "polite" : "assertive"}>
          <s-banner tone={result.tone}>
            <s-stack direction="block" gap="small-200">
              <span>{result.message}</span>
              {result.barcode && <span>Scanned barcode: {result.barcode}</span>}
              {result.matchingProducts?.length > 0 && (
                <s-unordered-list>
                  {result.matchingProducts.map((line) => (
                    <s-list-item key={line.id}>
                      {line.productTitle}
                      {line.variantTitle ? ` — ${line.variantTitle}` : ""}
                    </s-list-item>
                  ))}
                </s-unordered-list>
              )}
            </s-stack>
          </s-banner>
        </div>
      )}
      {(queue.length > 0 || currentBarcode.current) && (
        <s-text>Processing scans…</s-text>
      )}
    </div>
  );
}
