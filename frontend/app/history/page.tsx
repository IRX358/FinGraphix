import { FileSpreadsheet } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function HistoryPage() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4 pt-20">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Analysis History</h1>
        <p className="text-muted-foreground">
          Your past forensic analyses will appear here. Upload a dataset to get started.
        </p>
        <Button asChild className="mt-2">
          <Link href="/">Upload Dataset</Link>
        </Button>
      </div>
    </main>
  )
}
