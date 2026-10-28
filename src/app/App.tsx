import { lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { ErrorBoundary } from './ErrorBoundary';
import { Layout } from './Layout';

const HomePage = lazy(() => import('@/pages/HomePage'));
const LearnPage = lazy(() => import('@/pages/LearnPage'));
const LessonPage = lazy(() => import('@/pages/LessonPage'));
const LabPage = lazy(() => import('@/pages/LabPage'));
const PracticePage = lazy(() => import('@/pages/PracticePage'));
const PracticeSessionPage = lazy(() => import('@/pages/PracticeSessionPage'));
const ExamPage = lazy(() => import('@/pages/ExamPage'));
const DiagnosticPage = lazy(() => import('@/pages/DiagnosticPage'));
const ProgressPage = lazy(() => import('@/pages/ProgressPage'));
const AboutPage = lazy(() => import('@/pages/AboutPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      <ErrorBoundary>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="learn" element={<LearnPage />} />
            <Route path="learn/:moduleId" element={<LessonPage />} />
            <Route path="lab" element={<LabPage />} />
            <Route path="lab/:tool" element={<LabPage />} />
            <Route path="practice" element={<PracticePage />} />
            <Route path="practice/session" element={<PracticeSessionPage />} />
            <Route path="exam" element={<ExamPage />} />
            <Route path="diagnostic" element={<DiagnosticPage />} />
            <Route path="progress" element={<ProgressPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
