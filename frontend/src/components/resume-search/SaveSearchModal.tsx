import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Modal } from "../ui";
import { useCreateSavedSearchMutation } from "../../store/api/savedSearchesApi";
import { describeApiError } from "../../store/api/baseApi";
import { useNotify } from "../../hooks/useNotify";
import { summarizeSearch } from "./searchUrl";
import type { ResumeSearch } from "./searchUrl";

/** Asks for a name and saves the current resume search for the signed-in user. */
export default function SaveSearchModal({ search, onClose }: { search: ResumeSearch; onClose: () => void }) {
  const summary = summarizeSearch(search);
  const [name, setName] = useState(() => summary.replace(/"/g, "").slice(0, 80));
  const [error, setError] = useState<string | null>(null);
  const [create, { isLoading }] = useCreateSavedSearchMutation();
  const notify = useNotify();

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give this search a name.");
      return;
    }
    setError(null);
    try {
      await create({ name: trimmed, query: { ...search } }).unwrap();
      notify.success(`Saved "${trimmed}"`);
      onClose();
    } catch (err) {
      setError(describeApiError(err, "Couldn't save this search."));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Save search"
      description={summary}
      size="sm"
      preventClose={isLoading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" form="save-search-form" loading={isLoading}>
            Save
          </Button>
        </>
      }
    >
      <form id="save-search-form" onSubmit={submit} noValidate>
        <label htmlFor="save-search-name" className="zh-label">
          Name
        </label>
        <input
          id="save-search-name"
          data-autofocus
          className="zh-input"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? "save-search-error" : undefined}
          placeholder="e.g. Java leads, Bangalore, immediate"
        />
        {error && (
          <p id="save-search-error" className="mt-1 text-xs text-danger-600" role="alert">
            {error}
          </p>
        )}
        <p className="mt-3 text-xs text-muted">
          Find it later under{" "}
          <Link to="/search/saved" className="text-navy-600 hover:underline" onClick={onClose}>
            Saved searches
          </Link>
          .
        </p>
      </form>
    </Modal>
  );
}
