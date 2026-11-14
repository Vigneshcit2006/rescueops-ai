import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Landing } from "./pages/Landing";
import { LoadingBlock } from "./components/Feedback";

const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const MissionDetail = lazy(() => import("./pages/MissionDetail").then((m) => ({ default: m.MissionDetail })));
const MapPage = lazy(() => import("./pages/MapPage").then((m) => ({ default: m.MapPage })));
const AgentPage = lazy(() => import("./pages/AgentPage").then((m) => ({ default: m.AgentPage })));
const Decisions = lazy(() => import("./pages/Decisions").then((m) => ({ default: m.Decisions })));
const EvidencePage = lazy(() => import("./pages/Evidence").then((m) => ({ default: m.EvidencePage })));
const Resources = lazy(() => import("./pages/Resources").then((m) => ({ default: m.Resources })));
const Simulation = lazy(() => import("./pages/Simulation").then((m) => ({ default: m.Simulation })));
const Analytics = lazy(() => import("./pages/Analytics").then((m) => ({ default: m.Analytics })));
const Settings = lazy(() => import("./pages/Settings").then((m) => ({ default: m.Settings })));

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route element={<Layout />}>
        <Route
          path="/dashboard/:missionId"
          element={
            <Suspense fallback={<LoadingBlock />}>
              <Dashboard />
            </Suspense>
          }
        />
        <Route
          path="/mission/:id"
          element={
            <Suspense fallback={<LoadingBlock />}>
              <MissionDetail />
            </Suspense>
          }
        />
        <Route
          path="/map"
          element={
            <Suspense fallback={<LoadingBlock />}>
              <MapPage />
            </Suspense>
          }
        />
        <Route
          path="/agent"
          element={
            <Suspense fallback={<LoadingBlock />}>
              <AgentPage />
            </Suspense>
          }
        />
        <Route
          path="/decisions"
          element={
            <Suspense fallback={<LoadingBlock />}>
              <Decisions />
            </Suspense>
          }
        />
        <Route
          path="/evidence"
          element={
            <Suspense fallback={<LoadingBlock />}>
              <EvidencePage />
            </Suspense>
          }
        />
        <Route
          path="/resources"
          element={
            <Suspense fallback={<LoadingBlock />}>
              <Resources />
            </Suspense>
          }
        />
        <Route
          path="/simulation"
          element={
            <Suspense fallback={<LoadingBlock />}>
              <Simulation />
            </Suspense>
          }
        />
        <Route
          path="/analytics"
          element={
            <Suspense fallback={<LoadingBlock />}>
              <Analytics />
            </Suspense>
          }
        />
        <Route
          path="/settings"
          element={
            <Suspense fallback={<LoadingBlock />}>
              <Settings />
            </Suspense>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
