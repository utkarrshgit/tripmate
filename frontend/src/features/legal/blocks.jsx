// Building blocks for legal content files.
export const P = ({ children }) => <p className="t-body-md c-body">{children}</p>;

export const List = ({ items }) => (
  <ul className="legal-list">
    {items.map((item) => (
      <li key={item} className="t-body-md c-body">
        {item}
      </li>
    ))}
  </ul>
);
