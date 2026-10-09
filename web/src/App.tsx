// Route table. Present and Respond routes render full-screen (no app shell) so
// they work well on the big screen and on attendees' phones.

import { useRouter, matchRoute } from "./router";
import { Layout } from "./components/Layout";
import { ToastProvider } from "./components/ui";
import { Dashboard } from "./pages/Dashboard";
import { AttendeeDashboard } from "./pages/AttendeeDashboard";
import { Templates } from "./pages/Templates";
import { Settings } from "./pages/Settings";
import { Join, JoinConfirm } from "./pages/Join";
import { EventWorkspace } from "./pages/EventWorkspace";
import { SurveyBuilder } from "./pages/SurveyBuilder";
import { Respond } from "./pages/Respond";
import { LivePresent } from "./pages/LivePresent";
import { PublicItinerary } from "./pages/PublicItinerary";
import { IconCompass } from "./components/icons";

export function App() {
  const { path } = useRouter();

  // Full-screen routes (no shell).
  if (path === "/attendee") return <ToastProvider><AttendeeDashboard /></ToastProvider>;
  if (path === "/attendee/join") return <ToastProvider><Join attendeeMode /></ToastProvider>;
  const present = matchRoute("/present/:id", path);
  if (present) return <ToastProvider><LivePresent surveyId={present.id} /></ToastProvider>;
  const respond = matchRoute("/r/:id", path);
  if (respond) return <ToastProvider><Respond surveyId={respond.id} /></ToastProvider>;
  const itinerary = matchRoute("/e/:slug", path);
  if (itinerary) return <ToastProvider><PublicItinerary slug={itinerary.slug} /></ToastProvider>;
  const joinConfirm = matchRoute("/j/:code", path);
  if (joinConfirm) return <ToastProvider><JoinConfirm code={joinConfirm.code} /></ToastProvider>;

  // Shell routes.
  let view = <Dashboard />;
  const event = matchRoute("/events/:id", path);
  const survey = matchRoute("/surveys/:id", path);
  if (path === "/") view = <Dashboard />;
  else if (path.startsWith("/templates")) view = <Templates />;
  else if (path.startsWith("/join")) view = <Join />;
  else if (path.startsWith("/settings")) view = <Settings />;
  else if (event) view = <EventWorkspace eventId={event.id} />;
  else if (survey) view = <SurveyBuilder surveyId={survey.id} />;
  else view = <NotFound />;

  return (
    <ToastProvider>
      <Layout>{view}</Layout>
    </ToastProvider>
  );
}

function NotFound() {
  return (
    <div className="page">
      <div className="center-screen">
        <div className="empty">
          <div className="empty-icon"><IconCompass size={40} /></div>
          <h2>Page not found</h2>
          <p className="muted"><a href="/">Return to dashboard</a></p>
        </div>
      </div>
    </div>
  );
}
