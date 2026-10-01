import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/resume')({ component: Resume })

function Resume() {
  return (
    <main className="min-h-screen bg-[#07111f] p-4 text-[#eef5fb] md:p-8">
      <header className="mx-auto mb-4 flex max-w-6xl items-center justify-between gap-4">
        <a href="/" className="font-mono text-xs tracking-widest text-[#91a0b0] hover:text-[#2f91ff]">← PORTFOLIO</a>
        <a href="/Yufeng_Hou_Resume.pdf" download className="border border-[#253548] px-4 py-2 font-mono text-xs tracking-wider hover:border-[#2f91ff] hover:text-[#2f91ff]">DOWNLOAD PDF</a>
      </header>
      <iframe className="mx-auto block h-[calc(100vh-7rem)] w-full max-w-6xl border border-[#253548] bg-white" src="/Yufeng_Hou_Resume.pdf" title="Yufeng Hou résumé" />
    </main>
  )
}
