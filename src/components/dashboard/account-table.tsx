"use client";

import { type ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, type SortingState, useReactTable } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Download, ExternalLink, Flag, MoreHorizontal, Send, UserCheck, UserX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Logo, Pill, TierPill } from "@/components/ui/pills";
import { Bar, ScoreChip } from "@/components/ui/score";
import type { AccountRow } from "@/lib/accounts";
import { relativeTime } from "@/lib/format";
import { OUTREACH_LABEL, type OutreachType } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface RowActions {
  me: string;
  isAdmin: boolean;
  open: (id: string) => void;
  claim: (r: AccountRow) => void;
  release: (r: AccountRow) => void;
  log: (r: AccountRow, t: OutreachType) => void;
}

const LOG_TYPES = Object.keys(OUTREACH_LABEL) as OutreachType[];

const COL_CLASS: Record<string, string> = {
  company: "max-w-[280px]",
  division: "max-w-[150px]",
  owner: "max-w-[210px]",
  last: "hidden 2xl:table-cell",
  tier: "pl-4",
};

export function RowMenu({ r, a, open, onOpenChange }: { r: AccountRow; a: RowActions; open?: boolean; onOpenChange?: (v: boolean) => void }) {
  const mine = r.owner?.userId === a.me;
  const other = r.owner && !mine;
  return (
    <Menu open={open} onOpenChange={onOpenChange}>
      <MenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${r.name}`} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal size={16} />
        </Button>
      </MenuTrigger>
      <MenuContent>
        {!r.owner ? (
          <MenuItem onSelect={() => a.claim(r)}>
            <Flag size={14} /> Claim <kbd className="ml-auto text-[11px] text-muted">C</kbd>
          </MenuItem>
        ) : mine || a.isAdmin ? (
          <MenuItem onSelect={() => a.release(r)}>
            <UserX size={14} /> Release{other ? ` (${r.owner!.name})` : ""}
          </MenuItem>
        ) : (
          <MenuItem disabled>
            <UserCheck size={14} /> Claimed by {r.owner!.name}
          </MenuItem>
        )}
        {r.contact?.linkedinUrl ? (
          <MenuItem asChild>
            <a href={r.contact.linkedinUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> Open {r.contact.name} on LinkedIn
            </a>
          </MenuItem>
        ) : r.linkedinUrl ? (
          <MenuItem asChild>
            <a href={r.linkedinUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> Open company on LinkedIn
            </a>
          </MenuItem>
        ) : null}
        <MenuSeparator />
        <MenuLabel>
          Log outreach <kbd className="ml-1 text-[11px]">L</kbd>
        </MenuLabel>
        {LOG_TYPES.map((t) => (
          <MenuItem key={t} onSelect={() => a.log(r, t)} disabled={Boolean(other)}>
            <Send size={14} /> {OUTREACH_LABEL[t]}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem asChild>
          <a href={`/api/export?format=csv&ids=${r.id}`}>
            <Download size={14} /> Export CSV
          </a>
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function OwnerCell({ r, me }: { r: AccountRow; me: string }) {
  return (
    <div className="min-w-0 text-[13px]">
      <div className={cn("truncate", r.owner ? "" : "text-muted")}>{r.owner ? (r.owner.userId === me ? "You" : r.owner.name) : "Unclaimed"}</div>
      {r.contact ? (
        <div className="truncate text-[12px] text-muted">
          → {r.contact.name}, {r.contact.title}
        </div>
      ) : (
        <div className="text-[12px] text-muted">→ no contact yet</div>
      )}
    </div>
  );
}

function CompanyCell({ r }: { r: AccountRow }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Logo name={r.name} src={r.logoUrl} size={30} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold">{r.name}</span>
          {r.change === "new" ? <Pill tone="accent">NEW</Pill> : r.change === "upgraded" ? <Pill tone="hot">UPGRADED</Pill> : null}
        </div>
        <div className="truncate text-[12px] text-muted">
          {[r.domain, r.headcount ? `${r.headcount.toLocaleString("en")} empl.` : null].filter(Boolean).join(" · ")}
        </div>
        {r.topReason ? <div className="truncate text-[12px]">{r.topReason}</div> : null}
      </div>
    </div>
  );
}

function PriorityCell({ r }: { r: AccountRow }) {
  const all = [
    { label: `Cluster ${r.cluster} × weight`, points: r.cluster },
    { label: `Fit ${r.fit} × weight`, points: r.fit },
    { label: `Timing ${r.timing} × weight`, points: r.timing },
    { label: `Reach ${r.reach} × weight`, points: r.reach },
    ...r.breakdown.boost,
  ];
  return (
    <div className="flex w-28 items-center gap-2">
      <ScoreChip label="Priority" value={r.priority} factors={all} note="weighted sum + boosters" className="w-8" />
      <Bar value={r.priority} tone={r.tier === "hot" ? "hot" : r.tier === "warm" ? "warm" : "muted"} />
    </div>
  );
}

export function AccountTable({
  rows,
  a,
  focusIdx,
  setFocusIdx,
  logMenuFor,
  setLogMenuFor,
  onOrder,
}: {
  rows: AccountRow[];
  a: RowActions;
  focusIdx: number;
  setFocusIdx: (i: number) => void;
  logMenuFor: string | null;
  setLogMenuFor: (id: string | null) => void;
  onOrder: (ids: string[]) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "priority", desc: true }]);
  const columns = useMemo<ColumnDef<AccountRow>[]>(
    () => [
      { id: "tier", header: "Tier", accessorFn: (r) => ({ hot: 3, warm: 2, cold: 1 })[r.tier], cell: ({ row }) => <TierPill tier={row.original.tier} /> },
      { id: "company", header: "Company", accessorFn: (r) => r.name, cell: ({ row }) => <CompanyCell r={row.original} /> },
      { id: "division", header: "Division", accessorFn: (r) => r.division ?? "", cell: ({ row }) => <span className="text-[13px]">{row.original.division ?? <span className="text-muted">No cluster</span>}</span> },
      { id: "owner", header: "Owner → contact", accessorFn: (r) => r.owner?.name ?? "", cell: ({ row }) => <OwnerCell r={row.original} me={a.me} /> },
      {
        id: "cluster",
        header: "Cluster",
        accessorFn: (r) => r.cluster,
        cell: ({ row }) => <ScoreChip label="Hiring Cluster Index" value={row.original.cluster} factors={row.original.breakdown.cluster} note={row.original.division ?? undefined} />,
      },
      { id: "fit", header: "Fit", accessorFn: (r) => r.fit, cell: ({ row }) => <ScoreChip label="ICP fit" value={row.original.fit} factors={row.original.breakdown.fit} /> },
      { id: "priority", header: "Priority", accessorFn: (r) => r.priority, cell: ({ row }) => <PriorityCell r={row.original} /> },
      { id: "last", header: "Last signal", accessorFn: (r) => r.lastSignalAt ?? "", cell: ({ row }) => <span className="text-[12px] whitespace-nowrap text-muted">{relativeTime(row.original.lastSignalAt)}</span> },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => <RowMenu r={row.original} a={a} open={logMenuFor === row.original.id ? true : undefined} onOpenChange={(v) => !v && setLogMenuFor(null)} />,
      },
    ],
    [a, logMenuFor, setLogMenuFor],
  );
  const table = useReactTable({ data: rows, columns, getRowId: (r) => r.id, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
  const sorted = table.getRowModel().rows;
  const order = sorted.map((r) => r.id).join(",");
  useEffect(() => onOrder(order ? order.split(",") : []), [order, onOrder]);
  useEffect(() => {
    document.querySelector(`[data-row-index="${focusIdx}"]`)?.scrollIntoView({ block: "nearest" });
  }, [focusIdx]);

  return (
    <div className="hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
      <div className="max-h-[calc(100vh-180px)] overflow-auto">
        <table className="w-full text-left text-[13px]" aria-label="Accounts" aria-rowcount={sorted.length}>
          <thead className="sticky top-0 z-10 bg-surface">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-line">
                {hg.headers.map((h) => {
                  const sort = h.column.getIsSorted();
                  return (
                    <th key={h.id} scope="col" aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : undefined} className={cn("px-3 py-2 text-[12px] font-medium whitespace-nowrap text-muted", COL_CLASS[h.column.id])}>
                      {h.column.getCanSort() ? (
                        <button className="inline-flex items-center gap-1 hover:text-fg" onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sort === "asc" ? <ArrowUp size={12} /> : sort === "desc" ? <ArrowDown size={12} /> : null}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={row.id}
                data-row-index={i}
                aria-selected={i === focusIdx}
                onClick={() => {
                  setFocusIdx(i);
                  a.open(row.original.id);
                }}
                className={cn("cursor-pointer border-b border-line transition-colors duration-150 last:border-0 hover:bg-hover", i === focusIdx && "bg-hover outline-2 -outline-offset-2 outline-accent")}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={cn("px-3 py-2.5 align-middle", COL_CLASS[cell.column.id])}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Card layout for narrow screens. */
export function AccountCards({ rows, a }: { rows: AccountRow[]; a: RowActions }) {
  return (
    <ul className="space-y-2 md:hidden" aria-label="Accounts">
      {rows.map((r) => (
        <li key={r.id} className="rounded-xl border border-line bg-surface p-3">
          <div className="flex items-start gap-2">
            <button className="min-w-0 flex-1 text-left" onClick={() => a.open(r.id)}>
              <CompanyCell r={r} />
            </button>
            <RowMenu r={r} a={a} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
            <TierPill tier={r.tier} />
            <span className="text-muted">{r.division ?? "No cluster"}</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
            <div>
              <div className="text-muted">Cluster</div>
              <ScoreChip label="Hiring Cluster Index" value={r.cluster} factors={r.breakdown.cluster} className="-ml-1.5" />
            </div>
            <div>
              <div className="text-muted">Fit</div>
              <ScoreChip label="ICP fit" value={r.fit} factors={r.breakdown.fit} className="-ml-1.5" />
            </div>
            <div>
              <div className="text-muted">Priority</div>
              <PriorityCell r={r} />
            </div>
          </div>
          <div className="mt-2 border-t border-line pt-2">
            <OwnerCell r={r} me={a.me} />
          </div>
        </li>
      ))}
    </ul>
  );
}
