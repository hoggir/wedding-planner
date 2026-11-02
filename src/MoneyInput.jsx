import { useLayoutEffect, useRef } from "react";

const formatter = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

export default function MoneyInput({
  value,
  onChange,
  min = 0,
  max = 1e12,
  ...props
}) {
  const inputRef = useRef(null);
  const cursorDigits = useRef(null);
  useLayoutEffect(() => {
    const input = inputRef.current;
    input.setCustomValidity(
      value !== "" && (value < min || value > max)
        ? `Nominal harus antara ${formatter.format(min)} dan ${formatter.format(max)}.`
        : "",
    );
    if (cursorDigits.current !== null && document.activeElement === input) {
      let position = 0;
      let digits = 0;
      while (position < input.value.length && digits < cursorDigits.current) {
        if (/\d/.test(input.value[position])) digits++;
        position++;
      }
      input.setSelectionRange(position, position);
    }
    cursorDigits.current = null;
  });
  return (
    <input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={value === "" ? "" : formatter.format(value)}
      onChange={(event) => {
        const input = event.target;
        const plain = input.value.replace(/^Rp\s*/i, "").replace(/[.\s]/g, "");
        if (!/^\d*$/.test(plain)) return;
        const number = plain === "" ? "" : Number(plain);
        if (number !== "" && !Number.isSafeInteger(number)) return;
        cursorDigits.current = input.value
          .slice(0, input.selectionStart)
          .replace(/\D/g, "").length;
        onChange(number);
      }}
      onKeyDown={(event) => {
        const input = event.currentTarget;
        const position = input.selectionStart;
        if (position !== input.selectionEnd) return;
        if (event.key === "Backspace" && input.value[position - 1] === ".")
          input.setSelectionRange(position - 1, position - 1);
        else if (event.key === "Delete" && input.value[position] === ".")
          input.setSelectionRange(position + 1, position + 1);
      }}
    />
  );
}
