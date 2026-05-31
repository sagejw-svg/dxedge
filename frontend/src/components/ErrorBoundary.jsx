import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('DXEdge widget error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      const { label = 'Widget' } = this.props
      return (
        <div style={{
          background: 'var(--bg1)', border: '1px solid #ff4d4d33',
          borderLeft: '3px solid #ff4d4d', borderRadius: 8,
          padding: '14px 16px',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#ff4d4d', marginBottom: 6 }}>
            ⚠ {label} failed to render
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--dim)', fontStyle: 'italic', marginBottom: 10 }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--muted)', padding: '4px 10px', borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
