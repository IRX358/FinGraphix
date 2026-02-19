"use client"

import React from "react"

import { Database, Hash, Type, Calendar, HelpCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { DatasetProfile, ColumnType } from "@/lib/types"

interface DatasetSummaryProps {
  profile: DatasetProfile
}

const typeIcons: Record<ColumnType, React.ReactNode> = {
  number: <Hash className="h-3 w-3" />,
  category: <Type className="h-3 w-3" />,
  date: <Calendar className="h-3 w-3" />,
  unknown: <HelpCircle className="h-3 w-3" />,
}

const typeBadgeVariants: Record<ColumnType, "default" | "secondary" | "outline"> = {
  number: "default",
  category: "secondary",
  date: "outline",
  unknown: "outline",
}

export function DatasetSummary({ profile }: DatasetSummaryProps) {
  return (
    <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-1.5 rounded-[4px] bg-primary/10">
            <Database className="h-4 w-4 text-primary" />
          </div>
          Dataset
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[6px] bg-primary/5 border border-primary/20 p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Rows</p>
            <p className="text-xl font-semibold text-primary">{profile.rowCount.toLocaleString()}</p>
          </div>
          <div className="rounded-[6px] bg-muted/50 border border-border/50 p-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Columns</p>
            <p className="text-xl font-semibold">{profile.colCount}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">Columns</p>
          <ScrollArea className="h-[300px]">
            <div className="space-y-2 pr-4">
              {profile.columns.map((column) => (
                <div
                  key={column.name}
                  className="flex items-center justify-between rounded-[6px] border border-border/50 bg-card/50 p-2 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant={typeBadgeVariants[column.type]} className="shrink-0 gap-1">
                      {typeIcons[column.type]}
                      {column.type}
                    </Badge>
                    <span className="truncate text-sm" title={column.name}>
                      {column.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {column.missingPct > 0 && (
                      <span className="text-xs text-destructive/80">
                        {(column.missingPct * 100).toFixed(0)}% null
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {column.cardinality} unique
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  )
}
