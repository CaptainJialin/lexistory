import { GRAMMAR_OPTIONS } from "@/lib/types";
import GrammarDetail from "./grammar-detail";

export function generateStaticParams() {
  return GRAMMAR_OPTIONS.map((grammar) => ({ id: grammar.id }));
}
export default function Page() { return <GrammarDetail />; }
