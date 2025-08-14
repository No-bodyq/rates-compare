import Image from "next/image";
import Send from "../components/send";


export default function Home() {
  return (
    <div className="items-center justify-items-center p-8 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="w-full flex flex-col justify-center sm:items-center">
        <Send />
      </main>
    </div>
  );
}
