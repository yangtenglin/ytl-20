export default function Toast({ message, type = 'info' }) {
  return <div className={`toast ${type}`}>{message}</div>;
}
