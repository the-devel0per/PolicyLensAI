import { Link } from "react-router-dom";

export default function EmptyState({ icon: Icon, title, description, actionLabel, actionTo }) {
  return (
    <div className="glass flex flex-col items-center gap-4 px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent-fg">
        <Icon className="size-7" aria-hidden="true" />
      </span>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mx-auto max-w-prose text-fg-muted">{description}</p>
      </div>
      {actionTo && (
        <Link to={actionTo} className="btn btn-primary mt-2">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
