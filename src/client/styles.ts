/**
 * Plugin-owned stylesheet, injected once into `document.head`.
 *
 * The status bar lives in `conversation.input.dock`, the same slot dsh's own
 * QueueDock occupies. A dock child is stretched to the **full width of the
 * conversation column** by the flex parent, so it must constrain itself or it
 * draws wider than the composer card above which it sits — dsh's QueueDock does
 * exactly this:
 *
 *   width: calc(100% - 2 * clearance - 2 * inset); max-width: card - 2 * inset
 *
 * We mirror the same two custom properties (`--dsh-composer-card-max-width`,
 * `--dsh-composer-side-clearance`) without the extra dock inset, so the bar lines
 * up edge to edge with the composer card in every layout, including the narrow
 * `embedded` variant. Fallbacks keep it sane if a future dsh drops the names.
 */

export const PLUGIN_CSS = `
.sqs-bi-bar {
  box-sizing: border-box;
  width: calc(100% - 2 * var(--dsh-composer-side-clearance, 16px));
  max-width: var(--dsh-composer-card-max-width, 952px);
  margin: 0 auto;
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 3px 8px;
  border-radius: var(--dsw-radius-lg, 12px);
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.1));
  color: var(--dsw-alias-label-secondary, inherit);
  font-size: 12px;
  line-height: 18px;
  position: relative;
  overflow: hidden;
}
.sqs-bi-bar:after {
  content: "";
  position: absolute;
  inset: 0;
  border: 0.5px solid var(--dsw-alias-border-l1, transparent);
  border-radius: inherit;
  pointer-events: none;
}
.sqs-bi-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dsw-alias-state-error-secondary, #e5484d);
  animation: sqs-bi-pulse 1.2s ease-in-out infinite;
}
.sqs-bi-spin {
  flex: none;
  width: 11px;
  height: 11px;
  border: 1.5px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  opacity: 0.7;
  animation: sqs-bi-spin 0.9s linear infinite;
}
.sqs-bi-label {
  flex: none;
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsw-alias-label-primary, inherit);
  font-weight: 500;
}
.sqs-bi-detail {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.75;
}
.sqs-bi-clock {
  flex: none;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
  padding: 0 6px;
  border-radius: 5px;
  background: var(--dsw-alias-bg-layer-1, rgba(128, 128, 128, 0.16));
  color: var(--dsw-alias-label-primary, inherit);
}
.sqs-bi-meter {
  flex: 0 1 108px;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 2px;
  height: 18px;
  overflow: hidden;
  opacity: 0.55;
}
.sqs-bi-meter i {
  flex: none;
  display: block;
  width: 3px;
  border-radius: 2px;
  background: currentColor;
  transition: height 0.12s linear;
}
.sqs-bi-space {
  flex: 1 1 auto;
  min-width: 4px;
}
.sqs-bi-count {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  padding: 0 6px 0 4px;
  border-radius: 5px;
  background: var(--dsw-alias-bg-layer-1, rgba(128, 128, 128, 0.16));
  color: var(--dsw-alias-label-primary, inherit);
}
.sqs-bi-count[data-urgent="true"] {
  color: var(--dsw-alias-state-error-secondary, #e5484d);
}
.sqs-bi-ring {
  flex: none;
  transform: rotate(-90deg);
}
.sqs-bi-ring circle {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}
.sqs-bi-ring .sqs-bi-ring-track {
  opacity: 0.25;
}
.sqs-bi-btn {
  flex: none;
  appearance: none;
  border: 0;
  border-radius: 6px;
  padding: 3px 10px;
  font: inherit;
  line-height: 16px;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  color: inherit;
}
.sqs-bi-btn[data-tone="ghost"]:hover {
  background: var(--dsw-alias-bg-layer-1, rgba(128, 128, 128, 0.16));
}
.sqs-bi-btn[data-tone="danger"] {
  background: var(--dsw-alias-state-error-secondary, #e5484d);
  color: #fff;
}
.sqs-bi-btn[data-tone="danger"]:hover {
  filter: brightness(1.06);
}
.sqs-bi-bar[data-state="error"] .sqs-bi-label,
.sqs-bi-bar[data-state="polish-error"] .sqs-bi-label {
  color: var(--dsw-alias-state-error-secondary, #e5484d);
}
@keyframes sqs-bi-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
@keyframes sqs-bi-spin {
  to { transform: rotate(360deg); }
}
`
