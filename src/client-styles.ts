export const STYLES = `
[class$="_panel"]:has(.cc-page){width:min(1080px,calc(100vw - 32px))!important;max-width:min(1080px,calc(100vw - 32px))!important;height:min(900px,calc(100vh - 24px))}
.cc-page{--cc-text:var(--dsw-alias-label-primary,#17202b);--cc-muted:var(--dsw-alias-label-tertiary,#75808c);--cc-border:var(--dsw-alias-border-l2,#e4e8ed);--cc-card:var(--dsw-alias-settings-card-fill,#fff);--cc-accent:var(--dsw-alias-brand-primary,#1677ff);color:var(--cc-text);max-width:960px;padding:4px 4px 24px;font-size:14px;line-height:1.5}
.cc-page *{box-sizing:border-box}
.cc-page button,.cc-page input,.cc-page select,.cc-page textarea{font:inherit}
.cc-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin:0 0 22px}
.cc-heading{display:flex;align-items:center;gap:12px;min-width:0}
.cc-mark{width:42px;height:42px;display:grid;place-items:center;flex:none;border-radius:13px;background:color-mix(in srgb,var(--cc-accent) 12%,transparent);color:var(--cc-accent);font-size:22px;font-weight:700}
.cc-header h2{font-size:20px;line-height:26px;margin:0;font-weight:650;letter-spacing:-.02em}
.cc-subtitle{margin:4px 0 0;color:var(--cc-muted);font-size:13px}
.cc-header-actions,.cc-card-actions,.cc-editor-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cc-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:36px;padding:0 13px;border:1px solid var(--cc-border);border-radius:10px;background:var(--cc-card);color:var(--cc-text);font-weight:550;cursor:pointer;white-space:nowrap;transition:border-color .15s,background .15s,box-shadow .15s}
.cc-btn:hover:not(:disabled){border-color:var(--cc-accent);background:color-mix(in srgb,var(--cc-accent) 5%,var(--cc-card))}
.cc-btn:focus-visible,.cc-page input:focus-visible,.cc-page select:focus-visible,.cc-page textarea:focus-visible{outline:2px solid var(--cc-accent);outline-offset:2px}
.cc-btn:disabled{cursor:not-allowed;opacity:.48}
.cc-btn-primary{border-color:var(--cc-accent);background:var(--cc-accent);color:#fff}
.cc-btn-primary:hover:not(:disabled){background:color-mix(in srgb,var(--cc-accent) 86%,#000);color:#fff}
.cc-btn-quiet{border-color:transparent;background:transparent;color:var(--cc-muted)}
.cc-btn-danger{color:#d43c45}.cc-btn-danger:hover:not(:disabled){border-color:#d43c45;background:rgba(212,60,69,.06)}
.cc-filterbar{display:flex;align-items:center;gap:7px;margin:0 0 15px;flex-wrap:wrap}
.cc-filter{border:1px solid transparent;border-radius:9px;background:transparent;color:var(--cc-muted);padding:6px 11px;cursor:pointer;font-size:13px}
.cc-filter:hover{background:color-mix(in srgb,var(--cc-accent) 5%,transparent)}
.cc-filter[aria-pressed=true]{border-color:var(--cc-border);background:var(--cc-card);color:var(--cc-text);font-weight:600;box-shadow:0 1px 3px rgba(18,32,54,.05)}
.cc-filter-count{margin-left:5px;color:var(--cc-muted);font-variant-numeric:tabular-nums}
.cc-list{display:grid;gap:12px}
.cc-available{margin-top:28px}.cc-available-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:0 0 12px;flex-wrap:wrap}.cc-available-head h3{margin:0;font-size:15px;font-weight:650}.cc-available-head span{font-size:12px;color:var(--cc-muted)}
.cc-source-card{padding:15px 18px}.cc-source-card .cc-card-bottom{margin-top:12px;padding-top:10px}
.cc-card{border:1px solid var(--cc-border);border-radius:16px;background:var(--cc-card);padding:18px 20px;box-shadow:0 2px 8px rgba(20,32,52,.035);transition:border-color .16s,box-shadow .16s}
.cc-card:hover{border-color:color-mix(in srgb,var(--cc-accent) 45%,var(--cc-border));box-shadow:0 4px 18px rgba(20,32,52,.07)}
.cc-card-active{border-color:color-mix(in srgb,var(--cc-accent) 65%,var(--cc-border))}
.cc-card-top{display:flex;align-items:flex-start;gap:14px}
.cc-card-icon{width:40px;height:40px;flex:none;display:grid;place-items:center;border:1px solid var(--cc-border);border-radius:12px;background:color-mix(in srgb,var(--cc-accent) 5%,var(--cc-card));color:var(--cc-accent);font-weight:750;font-size:17px}
.cc-card-main{min-width:0;flex:1}
.cc-card-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cc-card-title h3{font-size:16px;line-height:23px;margin:0;font-weight:650}
.cc-card-url{color:var(--cc-muted);font-size:13px;overflow-wrap:anywhere;margin:4px 0 0}
.cc-card-model{color:var(--cc-text);font-size:13px;margin:12px 0 0;padding-left:54px}
.cc-card-model span{color:var(--cc-muted)}
.cc-card-bottom{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:15px;padding-top:14px;border-top:1px solid var(--cc-border);flex-wrap:wrap}
.cc-card-hint{color:var(--cc-muted);font-size:12px}
.cc-pill{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--cc-border);border-radius:999px;padding:2px 8px;color:var(--cc-muted);font-size:11px;font-weight:600;white-space:nowrap}
.cc-pill-on{border-color:color-mix(in srgb,var(--cc-accent) 35%,var(--cc-border));background:color-mix(in srgb,var(--cc-accent) 9%,transparent);color:var(--cc-accent)}
.cc-note,.cc-alert{padding:11px 13px;border:1px solid var(--cc-border);border-radius:11px;background:color-mix(in srgb,var(--cc-accent) 3%,var(--cc-card));color:var(--cc-muted);font-size:13px;margin:0 0 15px}
.cc-alert{border-color:#df8b8b;color:#b33139;background:rgba(220,70,80,.04)}
.cc-empty{border:1px dashed var(--cc-border);border-radius:15px;padding:34px 20px;text-align:center;color:var(--cc-muted)}
.cc-back{width:38px;height:38px;padding:0;font-size:20px}
.cc-tabs{display:flex;gap:5px;border-bottom:1px solid var(--cc-border);margin:-4px 0 16px}.cc-tab{border:0;border-bottom:2px solid transparent;background:transparent;color:var(--cc-muted);padding:8px 14px 10px;cursor:pointer;font-size:13px;font-weight:550}.cc-tab:hover{color:var(--cc-text)}.cc-tab[aria-selected=true]{border-bottom-color:var(--cc-accent);color:var(--cc-accent);font-weight:650}
.cc-editor{display:grid;gap:16px}
.cc-section{border:1px solid var(--cc-border);border-radius:16px;background:var(--cc-card);padding:20px}
.cc-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:0 0 17px}
.cc-section h3{font-size:15px;margin:0;font-weight:650}
.cc-section p{font-size:12px;margin:4px 0 0;color:var(--cc-muted)}
.cc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.cc-field{display:grid;align-content:start;gap:7px;min-width:0;font-size:13px;font-weight:550}
.cc-field-wide{grid-column:1/-1}
.cc-field small{color:var(--cc-muted);font-weight:400;line-height:1.45}
.cc-input,.cc-select{width:100%;height:39px;border:1px solid var(--cc-border);border-radius:9px;background:var(--cc-card);color:var(--cc-text);padding:0 11px;outline:none}
.cc-input::placeholder{color:var(--cc-muted)}
.cc-select:disabled,.cc-input:disabled{opacity:.6;cursor:not-allowed}
.cc-switch-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid var(--cc-border)}
.cc-switch-row:first-child{border-top:0;padding-top:0}
.cc-switch-row strong{display:block;font-size:13px}.cc-switch-row small{display:block;color:var(--cc-muted);font-size:12px;margin-top:2px}
.cc-switch-row input[type=checkbox]{width:17px;height:17px;accent-color:var(--cc-accent);cursor:pointer}
.cc-editor-shell{display:flex;border:1px solid var(--cc-border);border-radius:10px;overflow:hidden;background:color-mix(in srgb,var(--cc-card) 94%,#dce6f0)}
.cc-lines{min-width:43px;padding:12px 9px 12px 5px;text-align:right;border-right:1px solid var(--cc-border);color:var(--cc-muted);user-select:none;font:12px/21px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre}
.cc-json{display:block;flex:1;min-height:420px;max-height:560px;resize:vertical;border:0;background:transparent;color:var(--cc-text);padding:12px;outline:none;font:12px/21px ui-monospace,SFMono-Regular,Menlo,monospace;tab-size:2;white-space:pre;overflow:auto}
.cc-json:focus-visible{outline:none!important}
.cc-editor-foot{position:sticky;bottom:0;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 0;background:var(--dsw-alias-bg-layer-2,var(--cc-card));border-top:1px solid var(--cc-border)}
.cc-filepath{color:var(--cc-muted);font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}
@media(max-width:680px){.cc-header{flex-direction:column}.cc-header-actions{width:100%}.cc-grid{grid-template-columns:1fr}.cc-card{padding:15px}.cc-card-model{padding-left:0}.cc-editor-foot{flex-direction:column;align-items:stretch}.cc-editor-actions{justify-content:flex-end}}
`

export function installStyles(): () => void {
  const style = document.createElement('style')
  style.dataset.dshClaudeCode = 'settings'
  style.textContent = STYLES
  document.head.appendChild(style)
  return () => style.remove()
}
