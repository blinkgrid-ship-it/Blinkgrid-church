import { Component, type ErrorInfo, type ReactNode } from "react";
import { BookOpen } from "lucide-react";
import { Notice } from "./Notice";
import i18n from "../i18n";
import { openFeedback } from "../feedback/openFeedback";
import { withLanguage } from "../lang/urlLanguage";
import { crashReport, isStaleChunkError } from "./crashKind";
import "./crash.css";

type Props = {
  children: ReactNode;
  /** When this changes (the page address), a shown error is cleared so the reader can move on. */
  resetKey?: string;
  /** The Feedback box exists only inside the site, so the outermost screen leaves "Tell us about it" out. */
  canReport?: boolean;
};
type State = { failed: boolean; error: unknown };

// Written in plain words for a reader whose page stopped working: reload, go home, or tell us. The
// words come from the common namespace; the English fallback keeps the screen readable even if a
// language file has not loaded.
const say = (key: string, fallback: string) => i18n.t(`common:${key}`, { defaultValue: fallback });

/** Shows a calm screen instead of a blank page when something on the page throws. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("The page stopped working:", error, info.componentStack);
  }

  componentDidUpdate(previous: Props) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false, error: null });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const updated = isStaleChunkError(this.state.error);
    return (
      <div className="os-empty os-crash">
        <BookOpen aria-hidden="true" />
        <Notice tone="error" className="os-crash-notice">
        <h2>{updated ? say("crashUpdatedTitle", "The site has just been updated") : say("crashTitle", "Something went wrong")}</h2>
        <p>
          {updated
            ? say("crashUpdatedBody", "Reload the page to get the latest version.")
            : say("crashBody", "This page could not be shown. Please reload it. If it keeps happening, tell us and we will fix it.")}
        </p>
        </Notice>
        <div className="os-crash-actions">
          <button type="button" className="os-crash-primary" onClick={() => window.location.reload()}>
            {say("crashReload", "Reload page")}
          </button>
          <a className="os-crash-link" href={withLanguage("/")}>
            {say("crashHome", "Go to the home page")}
          </a>
          {!updated && this.props.canReport !== false && (
            <button
              type="button"
              className="os-crash-link"
              onClick={() =>
                openFeedback({
                  category: "wrong",
                  text: crashReport(window.location.pathname + window.location.search, this.state.error),
                })
              }
            >
              {say("crashTell", "Tell us about it")}
            </button>
          )}
        </div>
      </div>
    );
  }
}
