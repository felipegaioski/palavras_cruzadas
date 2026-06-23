import { Navigate, Route, Routes } from "react-router-dom";
import { CreatePage } from "./pages/CreatePage";
import { EditorPage } from "./pages/EditorPage";
import { HomePage } from "./pages/HomePage";
import { PrintPage } from "./pages/PrintPage";
import { WordBankPage } from "./pages/WordBankPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/crosswords/create" element={<CreatePage />} />
      <Route path="/crosswords/:id/edit" element={<EditorPage />} />
      <Route path="/print" element={<PrintPage />} />
      <Route path="/word-bank" element={<WordBankPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
