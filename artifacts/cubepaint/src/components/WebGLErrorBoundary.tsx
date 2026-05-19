import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class WebGLErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="webgl-fallback">
          <div className="webgl-fallback-content">
            <div className="webgl-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
            </div>
            <h2>WebGL Required</h2>
            <p>
              CubePaint needs WebGL to render the 3D cube.
              Please open this app in a modern browser on your device.
            </p>
            <code>{this.state.message}</code>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
