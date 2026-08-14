/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";
import {
  exactBarcodeMatches,
  searchInventoryCountLines,
} from "../utils/inventory-count-search";
import styles from "./scan-or-search-input.module.css";

const RESULT_LIMIT = 10;
const SCAN_IDLE_MS = 80;
const SCANNER_MAX_KEY_INTERVAL_MS = 45;
const MIN_SCANNER_CHARACTERS = 3;
const TERMINATOR_GUARD_MS = SCAN_IDLE_MS * 2;

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
  const scanIdleTimer = useRef(null);
  const lastInputAt = useRef(null);
  const scannerCandidate = useRef(false);
  const valueRef = useRef("");
  const suppressTerminatorUntil = useRef(0);
  const refocusAfterScan = useRef(false);
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

  useEffect(
    () => () => window.clearTimeout(scanIdleTimer.current),
    [],
  );

  const resetScannerTracking = useCallback(() => {
    window.clearTimeout(scanIdleTimer.current);
    scanIdleTimer.current = null;
    lastInputAt.current = null;
    scannerCandidate.current = false;
  }, []);

  const queueBarcode = useCallback((rawBarcode) => {
    const barcode = String(rawBarcode ?? "").trim();
    if (!barcode) return false;
    if (scanningDisabled) {
      setResult({
        tone: "critical",
        message: "Finish or cancel product selection before scanning.",
      });
      return false;
    }
    resetScannerTracking();
    refocusAfterScan.current = document.activeElement === inputRef.current;
    suppressTerminatorUntil.current = performance.now() + TERMINATOR_GUARD_MS;
    valueRef.current = "";
    setValue("");
    setOpen(false);
    setActiveIndex(-1);
    setQueue((current) => [...current, barcode]);
    return true;
  }, [resetScannerTracking, scanningDisabled]);

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
    valueRef.current = "";
    setOpen(false);
    setActiveIndex(-1);
    const scannerStillOwnsFocus =
      document.activeElement === inputRef.current ||
      document.activeElement === document.body;
    if (refocusAfterScan.current && scannerStillOwnsFocus) focusInput();
    refocusAfterScan.current = false;
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
    resetScannerTracking();
    valueRef.current = "";
    setValue("");
    setOpen(false);
    setActiveIndex(-1);
    setResult(null);
    onLocateLine(line.id);
    focusInput();
  }

  function handleSubmit(event) {
    event.preventDefault();
    const query = valueRef.current.trim();
    if (!query) return;
    const barcodeMatches = exactBarcodeMatches(lines, query);
    if (barcodeMatches.length > 0 || allowUnknownBarcode) {
      queueBarcode(query);
      return;
    }
    if (activeIndex >= 0 && visibleMatches[activeIndex]) {
      selectLine(visibleMatches[activeIndex]);
    } else {
      setOpen(true);
    }
  }

  function handleKeyDown(event) {
    const isTerminator = event.key === "Enter" || event.key === "Tab";
    if (isTerminator && performance.now() < suppressTerminatorUntil.current) {
      event.preventDefault();
      return;
    }
    if (
      event.key === "Tab" &&
      valueRef.current.trim() &&
      (scannerCandidate.current || exactBarcodeMatches(lines, valueRef.current).length > 0)
    ) {
      event.preventDefault();
      queueBarcode(valueRef.current);
    } else if (event.key === "ArrowDown" && visibleMatches.length > 0) {
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

  function handleChange(event) {
    const nextValue = event.target.value;
    const previousValue = valueRef.current;
    const now = performance.now();
    const appendedCharacter =
      nextValue.length === previousValue.length + 1 &&
      nextValue.startsWith(previousValue);

    window.clearTimeout(scanIdleTimer.current);
    scanIdleTimer.current = null;

    if (!nextValue) {
      resetScannerTracking();
    } else if (!appendedCharacter) {
      lastInputAt.current = now;
      scannerCandidate.current = false;
    } else if (!previousValue) {
      lastInputAt.current = now;
      scannerCandidate.current = true;
    } else {
      const interval = now - lastInputAt.current;
      scannerCandidate.current =
        scannerCandidate.current && interval <= SCANNER_MAX_KEY_INTERVAL_MS;
      lastInputAt.current = now;
    }

    valueRef.current = nextValue;
    setValue(nextValue);
    setOpen(nextValue.trim().length > 0);
    setActiveIndex(-1);

    const query = nextValue.trim();
    if (!query || scanningDisabled) return;

    if (exactBarcodeMatches(lines, query).length > 0) {
      queueBarcode(query);
      return;
    }

    if (
      allowUnknownBarcode &&
      scannerCandidate.current &&
      query.length >= MIN_SCANNER_CHARACTERS
    ) {
      scanIdleTimer.current = window.setTimeout(() => {
        if (
          document.activeElement === inputRef.current &&
          scannerCandidate.current &&
          valueRef.current.trim() === query
        ) {
          queueBarcode(query);
        }
      }, SCAN_IDLE_MS);
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
          onChange={handleChange}
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
