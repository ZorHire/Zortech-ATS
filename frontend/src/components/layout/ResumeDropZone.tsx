import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileUp } from "lucide-react";
import { useAppSelector } from "../../hooks/useAppSelector";
import { selectUserRole } from "../../store/slices/authSlice";
import { useNotify } from "../../hooks/useNotify";
import { RESUME_FILE_RE, setDroppedResumes } from "../../lib/droppedResumes";

const STAFF = ["super_admin", "accounts_manager", "vendor_manager", "recruiter"];

/**
 * Drop resumes anywhere in ZorHire (for example straight from the desktop or Outlook) to
 * add them as candidates: they open in the bulk resume upload on the Candidates page.
 * Upload boxes that handle their own drops keep working as before.
 */
export default function ResumeDropZone() {
  const role = useAppSelector(selectUserRole);
  const navigate = useNavigate();
  const notify = useNotify();
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const [active, setActive] = useState(false);
  const depth = useRef(0);
  const enabled = !!role && STAFF.includes(role);

  useEffect(() => {
    if (!enabled) return;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const onEnter = (e: DragEvent) => { if (hasFiles(e)) { depth.current += 1; setActive(true); } };
    const onLeave = (e: DragEvent) => { if (hasFiles(e)) { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setActive(false); } };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      // An upload box underneath already accepted the drag: let it have the drop.
      if (e.defaultPrevented) { setActive(false); return; }
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      setActive(true);
    };
    const onDrop = (e: DragEvent) => {
      depth.current = 0;
      setActive(false);
      if (!hasFiles(e) || e.defaultPrevented) return;
      e.preventDefault(); // never let the browser open the file instead of ZorHire
      const files = Array.from(e.dataTransfer?.files ?? []);
      const resumes = files.filter((f) => RESUME_FILE_RE.test(f.name));
      if (!resumes.length) {
        notifyRef.current.error("Drop PDF or Word resumes (.pdf, .doc, .docx) to add candidates.");
        return;
      }
      if (resumes.length < files.length) notifyRef.current.info(`${files.length - resumes.length} file(s) skipped: only PDF and Word resumes are read.`);
      setDroppedResumes(resumes);
      navigate("/candidates?upload=dropped");
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [enabled, navigate]);

  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-navy-900/40 p-6" aria-hidden="true">
      <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-white bg-navy-600/90 px-10 py-8 text-center text-white shadow-pop">
        <FileUp size={36} />
        <p className="text-lg font-semibold">Drop resumes to add candidates</p>
        <p className="text-sm text-white/80">PDF or Word. ZorHire reads each one and lets you check the details before saving.</p>
      </div>
    </div>
  );
}
