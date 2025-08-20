// import RateEngine from "../components/RateEngine"
import RateEngine from "./pages/RateEngine";

export default function Home() {

  return (
    <div className="min-h-screen w-full">
      <main className="w-full min-h-screen flex flex-col items-center justify-center">
        {/* <Send /> */}
        <RateEngine />
      </main>
    </div>
  );
}