export default function EmptyCmsPage({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div>
      <h1 className="font-serif text-4xl">{title}</h1>
      <p className="mt-4 max-w-xl text-muted">{body}</p>
    </div>
  );
}
