#!/bin/bash

# Install console capture in Safari's current tab
# Must be run after page load; navigation clears it

SCRIPT='(function() {
  if (window.__consoleCapture) return "Already installed";
  window.__consoleCapture = [];
  const original = {};
  ["log", "warn", "error", "info", "debug"].forEach(method => {
    original[method] = console[method];
    console[method] = function(...args) {
      window.__consoleCapture.push({
        type: method,
        timestamp: Date.now(),
        args: args.map(a => {
          try { return typeof a === "object" ? JSON.stringify(a) : String(a); }
          catch(e) { return String(a); }
        })
      });
      original[method].apply(console, args);
    };
  });
  // Also capture uncaught errors
  window.__originalOnerror = window.onerror;
  window.onerror = function(msg, url, line, col, error) {
    window.__consoleCapture.push({
      type: "uncaught",
      timestamp: Date.now(),
      args: [msg + " at " + url + ":" + line + ":" + col]
    });
    if (window.__originalOnerror) {
      return window.__originalOnerror.apply(this, arguments);
    }
    return false;
  };
  // Capture unhandled promise rejections
  window.addEventListener("unhandledrejection", function(event) {
    window.__consoleCapture.push({
      type: "uncaught",
      timestamp: Date.now(),
      args: ["Unhandled Promise Rejection: " + (event.reason?.message || event.reason || "Unknown")]
    });
  });
  return "Console capture installed";
})()'

DIR="$(cd "$(dirname "$0")" && pwd)"
"$DIR/safari-eval.sh" "$SCRIPT"
