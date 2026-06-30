import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useAuth } from "@clerk/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck, Building2, Users, Package, Tag, KeyRound, Activity,
  Settings, FolderTree, BookOpen, HeadphonesIcon, Plus, Loader2,
  Trash2, Edit2, Check, X, TrendingUp, DollarSign, BarChart3,
  AlertCircle, CheckCircle2, Clock, ChevronDown, Eye, EyeOff,
  Save, RefreshCw, Globe, Star, MessageSquare, Upload, FileText,
  ToggleLeft, ToggleRight, Search, Badge as BadgeIcon, Briefcase,
  Crown, Zap, Bell, Lock, Code2, Terminal, Cpu, HardDrive,
  Server, Copy, Fingerprint, Wifi, Database, ShieldAlert,
  CircleCheck, CircleX, KeySquare, Cloud, Link2,
  Shield, CheckCircle, XCircle, Layers, PlugZap, Smartphone,
  Gift, CalendarClock, Ban, PlusCircle, Timer, TrendingDown, Percent,
  Phone, Mail, Twitter, Linkedin, Youtube,
  Bot, Radar, Command, Network, Gauge, Play, Pause, RotateCcw,
  AlertOctagon as AOctagon, TrendingUp as TUp, Boxes,
  MonitorDot, Cpu as CpuIcon, MemoryStick, ArrowUpRight,
  Workflow, ScanLine, FlaskConical,
  FileBarChart2, Gavel, FileSignature, ShieldCheck as SecurityIcon,
  Layout, AlertOctagon, Download, ChevronRight, Filter as FilterIcon,
  User, Banknote, CheckSquare, AlertCircle as ACircle,
  Globe2, Newspaper, ListOrdered, HelpCircle, PenLine, Info,
  CreditCard, Receipt, AlertTriangle,
  ArrowRight, ClipboardList, ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { API, useAdmin } from "../shared/api";
import { StatCard } from "../shared/components";
import {
  PLAN_SLUG_COLORS, PLAN_SLUG_LABELS, PLAN_FEATURE_FLAGS, TABS,
  arabicToSlug, PERM_LABELS
} from "../shared/constants";

export function UsageTab() {
  const { data, isLoading } = useAdmin<any>("/usage");

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold">ملخص الاستهلاك حسب الميزة</h3>
      {isLoading ? <Loader2 className="animate-spin mx-auto h-6 w-6" /> : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(data?.summary ?? []).map((s: any) => (
              <Card key={s.feature} className="border-border/50">
                <CardContent className="p-4">
                  <div className="font-bold text-sm mb-1">{s.feature}</div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span><strong className="text-foreground">{Number(s.totalUnits ?? 0).toLocaleString()}</strong> وحدة</span>
                    <span><strong className="text-foreground">${Number(s.totalCost ?? 0).toFixed(3)}</strong></span>
                    <span>{s.count} طلب</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <h3 className="text-sm font-bold pt-2">آخر السجلات</h3>
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-right text-xs">الميزة</TableHead>
                  <TableHead className="text-right text-xs">الوحدات</TableHead>
                  <TableHead className="text-right text-xs">التكلفة</TableHead>
                  <TableHead className="text-right text-xs">التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.logs ?? []).slice(0, 50).map((l: any) => (
                  <TableRow key={l.id} className="hover:bg-muted/20">
                    <TableCell className="text-xs font-medium">{l.feature}</TableCell>
                    <TableCell className="text-xs">{l.units}</TableCell>
                    <TableCell className="text-xs">${l.cost.toFixed(4)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleDateString("ar-SA")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   DEPARTMENTS TAB
═══════════════════════════════════════════════════ */
