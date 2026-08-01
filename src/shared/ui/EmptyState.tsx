type Props = {
  title: string;
  body?: string;
};

export function EmptyState({ title, body }: Props) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {body ? <div>{body}</div> : null}
    </div>
  );
}
