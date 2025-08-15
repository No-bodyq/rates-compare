import Send from "../components/send";
import RateEngine from "../components/test"

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