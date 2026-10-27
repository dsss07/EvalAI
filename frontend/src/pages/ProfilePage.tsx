import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/60 dark:bg-slate-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Link
            to="/"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            Dashboard
          </Link>
          <span>›</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            Student Profile
          </span>
        </div>

        {/* Header Profile Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-3xl shadow-md shadow-blue-500/20 shrink-0">
              {user.full_name ? user.full_name.charAt(0).toUpperCase() : "S"}
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {user.full_name}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Active Student</span>
                </span>
              </div>

              {user.usn && (
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  USN: <strong className="text-slate-700 dark:text-slate-300">{user.usn}</strong>
                </p>
              )}

              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-0.5">
                <span>✉️</span>
                <span>{user.email}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Academic Details Card (6-Box Grid) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            Academic Information
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Semester
              </span>
              <span className="text-base font-bold text-slate-900 dark:text-white mt-1 block">
                {user.semester ? `Semester ${user.semester}` : "N/A"}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Branch / Course
              </span>
              <span className="text-base font-bold text-slate-900 dark:text-white mt-1 block uppercase">
                {user.branch || "N/A"}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Section
              </span>
              <span className="text-base font-bold text-slate-900 dark:text-white mt-1 block uppercase">
                Section {user.section || "N/A"}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                University Seat No. (USN)
              </span>
              <span className="text-base font-bold font-mono text-slate-900 dark:text-white mt-1 block">
                {user.usn || "N/A"}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60 col-span-2 sm:col-span-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Registered Institutional Email
              </span>
              <span className="text-base font-bold text-slate-900 dark:text-white mt-1 block truncate">
                {user.email}
              </span>
            </div>
          </div>
        </div>

        {/* Account Details */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            Account Credentials & Access
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-slate-400 uppercase tracking-wider block font-semibold text-[10px]">
                Assigned Role
              </span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1 block capitalize">
                {user.role} (Student Portal)
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
              <span className="text-slate-400 uppercase tracking-wider block font-semibold text-[10px]">
                Registration Date
              </span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1 block">
                {user.created_at
                  ? new Date(user.created_at).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "Active Semester"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
