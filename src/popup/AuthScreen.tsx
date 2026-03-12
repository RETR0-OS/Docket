interface Props {
  onSignIn: () => void;
  loading: boolean;
  error?: string;
}

export default function AuthScreen({ onSignIn, loading, error }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 min-h-[200px]">
      <h1 className="text-xl font-bold">Docket</h1>
      <p className="text-sm text-gray-500 text-center">
        Sign in to use ::commands:: in any text field.
      </p>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button
        type="button"
        onClick={onSignIn}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded shadow-sm text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
      >
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path fill="#4285F4" d="M44.5 20H24v8.5h11.7C34.2 33.2 29.6 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 2.9l6.1-6.1C34.4 6.2 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.2-4z"/>
        </svg>
        {loading ? 'Signing in…' : 'Sign in with Google'}
      </button>
    </div>
  );
}
