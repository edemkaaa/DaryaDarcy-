import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth";
import { Shell } from "./Shell";
import Home from "./pages/Home";

const TrpcGate = lazy(() => import("./TrpcGate"));
const Feed = lazy(() => import("./pages/Feed"));
const Post = lazy(() => import("./pages/Post"));
const Videos = lazy(() => import("./pages/Videos"));
const Video = lazy(() => import("./pages/Video"));
const Club = lazy(() => import("./pages/Club"));
const Interactive = lazy(() => import("./pages/Interactive"));
const Library = lazy(() => import("./pages/Library"));
const About = lazy(() => import("./pages/About"));
const Shop = lazy(() => import("./pages/Shop"));
const Product = lazy(() => import("./pages/Product"));
const Profile = lazy(() => import("./pages/Profile"));
const Login = lazy(() => import("./pages/Login"));
const Quiz = lazy(() => import("./pages/Quiz"));

function Fallback() {
  return (
    <div className="boot">
      <div className="boot-title">DARYADARCY</div>
      <div className="boot-line" />
    </div>
  );
}

function withTrpc(node: ReactNode) {
  return <TrpcGate>{node}</TrpcGate>;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route element={<Shell />}>
              <Route path="/" element={<Home />} />
              <Route path="/feed" element={withTrpc(<Feed />)} />
              <Route path="/post/:id" element={withTrpc(<Post />)} />
              <Route path="/videos" element={withTrpc(<Videos />)} />
              <Route path="/video/:id" element={withTrpc(<Video />)} />
              <Route path="/club" element={<Club />} />
              <Route path="/interactive" element={<Interactive />} />
              <Route path="/quiz" element={<Quiz />} />
              <Route path="/library" element={<Library />} />
              <Route path="/library/about" element={<About />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/shop/:id" element={<Product />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/login" element={<Login />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
