import { Component } from 'react';

// If anything crashes, show what happened and a way out instead of an empty page.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  reset = () => {
    try {
      localStorage.removeItem('survive30sols.save.v1');
    } catch {
      /* storage may be blocked */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app">
        <div className="card" role="alert" style={{ marginTop: 24 }}>
          <h3>🚨 Houston, we have a problem</h3>
          <p>The game hit an error. Starting over usually fixes it.</p>
          <pre className="muted small" style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error && this.state.error.message)}</pre>
          <button className="btn btn-primary wide" onClick={this.reset}>Clear saved game and start over</button>
        </div>
      </div>
    );
  }
}
