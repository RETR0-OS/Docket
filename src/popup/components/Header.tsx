interface Props {
  email: string;
  onSignOut: () => void;
}

export default function Header({ email, onSignOut }: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-blue-600 text-white text-sm">
      <span className="font-semibold">Docket</span>
      <div className="flex items-center gap-2">
        <span className="opacity-80 text-xs truncate max-w-[140px]">{email}</span>
        <button
          type="button"
          onClick={onSignOut}
          className="text-xs border border-white/50 rounded px-2 py-0.5 hover:bg-white/20"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
