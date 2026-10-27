import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import Dashboard from "./pages/Dashboard";
import CreateSetPage from "./pages/CreateSetPage";
import ViewSetPage from "./pages/ViewSetPage";
import TakeExamPage from "./pages/TakeExamPage";
import ViewSubmissionsPage from "./pages/ViewSubmissionsPage";
import ComparisonPage from "./pages/ComparisonPage";
import MyResultsPage from "./pages/MyResultsPage";
import ProfilePage from "./pages/ProfilePage";
import TeacherMCQPage from "./pages/TeacherMCQPage";
import TakeMCQTestPage from "./pages/TakeMCQTestPage";
import TeacherMCQDetailsPage from "./pages/TeacherMCQDetailsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import TeacherStudentsPage from "./pages/TeacherStudentsPage";
import TeacherReportsPage from "./pages/TeacherReportsPage";
import SubmissionTrackingPage from "./pages/SubmissionTrackingPage";

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar />
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={user ? <Navigate to="/" /> : <RegisterPage />}
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute roles={["teacher"]}>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/teacher/students" element={<ProtectedRoute roles={["teacher"]}><TeacherStudentsPage /></ProtectedRoute>} />
        <Route path="/teacher/reports" element={<ProtectedRoute roles={["teacher"]}><TeacherReportsPage /></ProtectedRoute>} />
        <Route
          path="/sets/new"
          element={
            <ProtectedRoute roles={["teacher"]}>
              <CreateSetPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sets/new-mcq"
          element={
            <ProtectedRoute roles={["teacher"]}>
              <TeacherMCQPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sets/:id"
          element={
            <ProtectedRoute>
              <ViewSetPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sets/mcq/:id"
          element={
            <ProtectedRoute roles={["teacher"]}>
              <TeacherMCQDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/test/:id"
          element={
            <ProtectedRoute roles={["student"]}>
              <TakeExamPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/test/:id"
          element={
            <ProtectedRoute roles={["student"]}>
              <TakeMCQTestPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/student/submissions/:id"
          element={
            <ProtectedRoute roles={["student"]}>
              <SubmissionTrackingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sets/:id/submissions"
          element={
            <ProtectedRoute roles={["teacher"]}>
              <ViewSubmissionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sets/:id/comparison"
          element={
            <ProtectedRoute roles={["teacher"]}>
              <ComparisonPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-results"
          element={
            <ProtectedRoute roles={["student"]}>
              <MyResultsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute roles={["student"]}>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
