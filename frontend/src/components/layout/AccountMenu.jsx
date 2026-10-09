import { useCallback, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar, Icon } from "@/components/ui";
import { useDismiss } from "@/hooks/useDismiss";
import { useSession } from "@/state/session";

export default function AccountMenu() {
  const { user, logOut } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, close, open);

  return (
    <div className="account-menu" ref={ref}>
      <button
        type="button"
        className="icon-btn is-bare"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar name={user.name} />
      </button>
      {open && (
        <div className="account-popover" role="menu">
          <div className="account-popover-head">
            <Avatar name={user.name} size="lg" />
            <div>
              <p className="t-body-strong c-ink">{user.name}</p>
              <p className="t-body-sm c-mute">{user.email}</p>
            </div>
          </div>
          <div className="divided">
            <Link role="menuitem" to="/trips" className="menu-item" onClick={close}>
              <Icon name="bookmark" size={18} /> Your trips
            </Link>
            <Link role="menuitem" to="/account" className="menu-item" onClick={close}>
              <Icon name="user" size={18} /> Account
            </Link>
            <button
              role="menuitem"
              type="button"
              className="menu-item"
              onClick={() => {
                logOut();
                close();
                navigate("/");
              }}
            >
              <Icon name="logout" size={18} /> Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
