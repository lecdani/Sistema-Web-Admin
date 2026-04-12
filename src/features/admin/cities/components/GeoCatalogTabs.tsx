'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/shared/components/base/Button';
import { Input } from '@/shared/components/base/Input';
import { Label } from '@/shared/components/base/Label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/base/Card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/base/Dialog';
import { SearchableSelect } from '@/shared/components/base/Select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/components/base/AlertDialog';
import { Edit, Layers, MapPinned, Plus, Search, Trash2 } from 'lucide-react';
import type { Area, District, Region, Store } from '@/shared/types';
import { toast } from '@/shared/components/base/Toast';
import { areasApi } from '@/shared/services/areas-api';
import { regionsApi } from '@/shared/services/regions-api';
import { districtsApi } from '@/shared/services/districts-api';

const GEO_NAME_MAX = 25;
const GEO_ITEMS_PER_PAGE = 12;

function normId(id: string | undefined | null): string {
  return String(id ?? '').trim().toLowerCase();
}

function canDeleteArea(areaId: string, regions: Region[]): boolean {
  const k = normId(areaId);
  return !regions.some((r) => normId(r.areaId) === k);
}

function canDeleteRegion(regionId: string, districts: District[]): boolean {
  const k = normId(regionId);
  return !districts.some((d) => normId(d.regionId) === k);
}

function canDeleteDistrict(districtId: string, stores: Store[]): boolean {
  const k = normId(districtId);
  return !stores.some((s) => normId(s.districtId) === k);
}

type TranslateFn = (key: string) => string;

function GeoPaginationBar({
  page,
  totalPages,
  translate,
  setPage,
}: {
  page: number;
  totalPages: number;
  translate: TranslateFn;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex justify-center items-center mt-4 gap-2 flex-wrap">
      <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page === 1}>
        {translate('previous')}
      </Button>
      <span className="mx-1 text-sm text-gray-500">
        {translate('page')} {page} {translate('pageOf')} {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
        disabled={page === totalPages}
      >
        {translate('next')}
      </Button>
    </div>
  );
}

interface GeoPanelsProps {
  areas: Area[];
  regions: Region[];
  districts: District[];
  stores: Store[];
  translate: TranslateFn;
  onRefresh: () => void;
}

export function GeoAreasPanel({ areas, regions, translate, onRefresh }: Pick<GeoPanelsProps, 'areas' | 'regions' | 'translate' | 'onRefresh'>) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Area | null>(null);
  const [name, setName] = useState('');
  const [nameErr, setNameErr] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...areas].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return list;
    return list.filter((a) => a.name.toLowerCase().includes(q));
  }, [areas, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.ceil(filtered.length / GEO_ITEMS_PER_PAGE);
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page]);
  const pagedAreas = filtered.slice((page - 1) * GEO_ITEMS_PER_PAGE, page * GEO_ITEMS_PER_PAGE);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setNameErr('');
    setDialogOpen(true);
  };

  const openEdit = (a: Area) => {
    setEditing(a);
    setName(a.name);
    setNameErr('');
    setDialogOpen(true);
  };

  const validate = (): boolean => {
    const t = name.trim();
    if (!t) {
      setNameErr(translate('geoNameRequired'));
      return false;
    }
    if (t.length > GEO_NAME_MAX) {
      setNameErr(translate('geoNameTooLong'));
      return false;
    }
    const dup = areas.find((a) => a.name.trim().toLowerCase() === t.toLowerCase() && (!editing || a.id !== editing.id));
    if (dup) {
      setNameErr(translate('geoDuplicateArea'));
      return false;
    }
    setNameErr('');
    return true;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const t = name.trim();
      if (editing) {
        await areasApi.update(editing.id, t);
        toast.success(translate('geoAreaUpdated'));
      } else {
        await areasApi.create(t);
        toast.success(translate('geoAreaCreated'));
      }
      setDialogOpen(false);
      await onRefresh();
    } catch (e: any) {
      toast.error(e?.data?.message ?? e?.message ?? translate('geoSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async (a: Area) => {
    if (!canDeleteArea(a.id, regions)) {
      toast.error(translate('geoCannotDeleteArea'));
      return;
    }
    try {
      await areasApi.delete(a.id);
      toast.success(translate('geoAreaDeleted'));
      await onRefresh();
    } catch (e: any) {
      toast.error(e?.data?.message ?? e?.message ?? translate('geoDeleteError'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={translate('searchAreasPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          {translate('createArea')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pagedAreas.map((a) => (
          <Card key={a.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Layers className="h-5 w-5 text-emerald-600 shrink-0" />
                  <CardTitle className="text-base truncate">{a.name}</CardTitle>
                </div>
              </div>
              <CardDescription>{translate('geoAreaLabel')}</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2 pt-0">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(a)}>
                <Edit className="h-4 w-4 mr-1" />
                {translate('edit')}
              </Button>
              {canDeleteArea(a.id, regions) && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{translate('deleteAreaTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>{translate('deleteAreaConfirm').replace('{name}', a.name)}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => void doDelete(a)}
                      >
                        {translate('delete')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <GeoPaginationBar page={page} totalPages={totalPages} translate={translate} setPage={setPage} />

      {filtered.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-gray-500">
            {search ? translate('noAreasSearch') : translate('noAreas')}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? translate('editArea') : translate('newArea')}</DialogTitle>
            <DialogDescription>{editing ? translate('editAreaDesc') : translate('newAreaDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-6 py-4">
            <div>
              <Label htmlFor="areaName">{translate('geoNameLabel')}</Label>
              <Input
                id="areaName"
                value={name}
                maxLength={GEO_NAME_MAX}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameErr) setNameErr('');
                }}
                className={nameErr ? 'border-red-500' : ''}
              />
              {nameErr && <p className="text-sm text-red-600 mt-1">{nameErr}</p>}
              <p className="text-xs text-gray-500 mt-1">{translate('geoNameHint')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {translate('cancel')}
            </Button>
            <Button onClick={() => void save()} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? translate('saving') : editing ? translate('update') : translate('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function GeoRegionsPanel({
  areas,
  regions,
  districts,
  translate,
  onRefresh,
}: Pick<GeoPanelsProps, 'areas' | 'regions' | 'districts' | 'translate' | 'onRefresh'>) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Region | null>(null);
  const [areaId, setAreaId] = useState('');
  const [name, setName] = useState('');
  const [formErr, setFormErr] = useState<{ area?: string; name?: string }>({});
  const [saving, setSaving] = useState(false);

  const areaById = useMemo(() => {
    const m = new Map<string, Area>();
    areas.forEach((a) => m.set(normId(a.id), a));
    return m;
  }, [areas]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...regions].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return list;
    return list.filter((r) => {
      if (r.name.toLowerCase().includes(q)) return true;
      const ar = areaById.get(normId(r.areaId));
      return ar?.name.toLowerCase().includes(q);
    });
  }, [regions, search, areaById]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.ceil(filtered.length / GEO_ITEMS_PER_PAGE);
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page]);
  const pagedRegions = filtered.slice((page - 1) * GEO_ITEMS_PER_PAGE, page * GEO_ITEMS_PER_PAGE);

  const openCreate = () => {
    setEditing(null);
    setAreaId(areas[0]?.id ?? '');
    setName('');
    setFormErr({});
    setDialogOpen(true);
  };

  const openEdit = (r: Region) => {
    setEditing(r);
    setAreaId(r.areaId);
    setName(r.name);
    setFormErr({});
    setDialogOpen(true);
  };

  const validate = (): boolean => {
    const err: { area?: string; name?: string } = {};
    if (!areas.length) err.area = translate('geoNeedAreaFirst');
    else if (!areaId.trim()) err.area = translate('geoSelectAreaRequired');
    const t = name.trim();
    if (!t) err.name = translate('geoNameRequired');
    else if (t.length > GEO_NAME_MAX) err.name = translate('geoNameTooLong');
    const dup = regions.find(
      (r) =>
        normId(r.areaId) === normId(areaId) &&
        r.name.trim().toLowerCase() === t.toLowerCase() &&
        (!editing || r.id !== editing.id)
    );
    if (t && dup) err.name = translate('geoDuplicateRegion');
    setFormErr(err);
    return Object.keys(err).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const t = name.trim();
      const aid = areaId.trim();
      if (editing) {
        await regionsApi.update(editing.id, { areaId: aid, name: t });
        toast.success(translate('geoRegionUpdated'));
      } else {
        await regionsApi.create({ areaId: aid, name: t });
        toast.success(translate('geoRegionCreated'));
      }
      setDialogOpen(false);
      await onRefresh();
    } catch (e: any) {
      toast.error(e?.data?.message ?? e?.message ?? translate('geoSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async (r: Region) => {
    if (!canDeleteRegion(r.id, districts)) {
      toast.error(translate('geoCannotDeleteRegion'));
      return;
    }
    try {
      await regionsApi.delete(r.id);
      toast.success(translate('geoRegionDeleted'));
      await onRefresh();
    } catch (e: any) {
      toast.error(e?.data?.message ?? e?.message ?? translate('geoDeleteError'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={translate('searchRegionsPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={openCreate} disabled={!areas.length} className="bg-indigo-600 hover:bg-indigo-700 shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          {translate('createRegion')}
        </Button>
      </div>

      {!areas.length && (
        <p className="text-sm text-amber-700">{translate('geoNeedAreaFirst')}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pagedRegions.map((r) => {
          const ar = areaById.get(normId(r.areaId));
          return (
            <Card key={r.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start gap-2 min-w-0">
                  <MapPinned className="h-5 w-5 text-sky-600 shrink-0" />
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{r.name}</CardTitle>
                    <CardDescription className="truncate">
                      {ar?.name ?? translate('notSpecified')} · {translate('geoAreaLabel')}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex gap-2 pt-0">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(r)}>
                  <Edit className="h-4 w-4 mr-1" />
                  {translate('edit')}
                </Button>
                {canDeleteRegion(r.id, districts) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{translate('deleteRegionTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>{translate('deleteRegionConfirm').replace('{name}', r.name)}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => void doDelete(r)}>
                          {translate('delete')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <GeoPaginationBar page={page} totalPages={totalPages} translate={translate} setPage={setPage} />

      {filtered.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-gray-500">
            {search ? translate('noRegionsSearch') : areas.length ? translate('noRegions') : translate('noRegionsNeedAreas')}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? translate('editRegion') : translate('newRegion')}</DialogTitle>
            <DialogDescription>{editing ? translate('editRegionDesc') : translate('newRegionDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-6 py-4">
            <div>
              <Label>{translate('geoAreaLabel')} *</Label>
              <SearchableSelect
                value={areaId}
                placeholder={translate('geoSelectArea')}
                disabled={!areas.length}
                options={areas.map((a) => ({ value: a.id, label: a.name }))}
                onValueChange={(v) => {
                  setAreaId(v);
                  setFormErr((p) => ({ ...p, area: undefined }));
                }}
                aria-invalid={!!formErr.area}
                inputClassName={formErr.area ? 'border-red-500' : ''}
                zIndex={10000}
                maxListHeight="min(16rem, 55vh)"
              />
              {formErr.area && <p className="text-sm text-red-600 mt-1">{formErr.area}</p>}
            </div>
            <div>
              <Label htmlFor="regionName">{translate('geoNameLabel')}</Label>
              <Input
                id="regionName"
                value={name}
                maxLength={GEO_NAME_MAX}
                onChange={(e) => {
                  setName(e.target.value);
                  setFormErr((p) => ({ ...p, name: undefined }));
                }}
                className={formErr.name ? 'border-red-500' : ''}
              />
              {formErr.name && <p className="text-sm text-red-600 mt-1">{formErr.name}</p>}
              <p className="text-xs text-gray-500 mt-1">{translate('geoNameHint')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {translate('cancel')}
            </Button>
            <Button onClick={() => void save()} disabled={saving || !areas.length} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? translate('saving') : editing ? translate('update') : translate('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function GeoDistrictsPanel({
  areas,
  regions,
  districts,
  stores,
  translate,
  onRefresh,
}: GeoPanelsProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<District | null>(null);
  const [regionId, setRegionId] = useState('');
  const [name, setName] = useState('');
  const [formErr, setFormErr] = useState<{ region?: string; name?: string }>({});
  const [saving, setSaving] = useState(false);

  const areaById = useMemo(() => {
    const m = new Map<string, Area>();
    areas.forEach((a) => m.set(normId(a.id), a));
    return m;
  }, [areas]);

  const regionById = useMemo(() => {
    const m = new Map<string, Region>();
    regions.forEach((r) => m.set(normId(r.id), r));
    return m;
  }, [regions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...districts].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return list;
    return list.filter((d) => {
      if (d.name.toLowerCase().includes(q)) return true;
      const reg = regionById.get(normId(d.regionId));
      if (reg?.name.toLowerCase().includes(q)) return true;
      const ar = reg ? areaById.get(normId(reg.areaId)) : undefined;
      return ar?.name.toLowerCase().includes(q);
    });
  }, [districts, search, regionById, areaById]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.ceil(filtered.length / GEO_ITEMS_PER_PAGE);
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [totalPages, page]);
  const pagedDistricts = filtered.slice((page - 1) * GEO_ITEMS_PER_PAGE, page * GEO_ITEMS_PER_PAGE);

  const openCreate = () => {
    setEditing(null);
    setRegionId(regions[0]?.id ?? '');
    setName('');
    setFormErr({});
    setDialogOpen(true);
  };

  const openEdit = (d: District) => {
    setEditing(d);
    setRegionId(d.regionId);
    setName(d.name);
    setFormErr({});
    setDialogOpen(true);
  };

  const validate = (): boolean => {
    const err: { region?: string; name?: string } = {};
    if (!regions.length) err.region = translate('geoNeedRegionFirst');
    else if (!regionId.trim()) err.region = translate('geoSelectRegionRequired');
    const t = name.trim();
    if (!t) err.name = translate('geoNameRequired');
    else if (t.length > GEO_NAME_MAX) err.name = translate('geoNameTooLong');
    const dup = districts.find(
      (d) =>
        normId(d.regionId) === normId(regionId) &&
        d.name.trim().toLowerCase() === t.toLowerCase() &&
        (!editing || d.id !== editing.id)
    );
    if (t && dup) err.name = translate('geoDuplicateDistrict');
    setFormErr(err);
    return Object.keys(err).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const t = name.trim();
      const rid = regionId.trim();
      if (editing) {
        await districtsApi.update(editing.id, { regionId: rid, name: t });
        toast.success(translate('geoDistrictUpdated'));
      } else {
        await districtsApi.create({ regionId: rid, name: t });
        toast.success(translate('geoDistrictCreated'));
      }
      setDialogOpen(false);
      await onRefresh();
    } catch (e: any) {
      toast.error(e?.data?.message ?? e?.message ?? translate('geoSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async (d: District) => {
    if (!canDeleteDistrict(d.id, stores)) {
      toast.error(translate('geoCannotDeleteDistrict'));
      return;
    }
    try {
      await districtsApi.delete(d.id);
      toast.success(translate('geoDistrictDeleted'));
      await onRefresh();
    } catch (e: any) {
      toast.error(e?.data?.message ?? e?.message ?? translate('geoDeleteError'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={translate('searchDistrictsPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={openCreate} disabled={!regions.length} className="bg-indigo-600 hover:bg-indigo-700 shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          {translate('createDistrict')}
        </Button>
      </div>

      {!regions.length && (
        <p className="text-sm text-amber-700">{translate('geoNeedRegionFirst')}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pagedDistricts.map((d) => {
          const reg = regionById.get(normId(d.regionId));
          const ar = reg ? areaById.get(normId(reg.areaId)) : undefined;
          return (
            <Card key={d.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start gap-2 min-w-0">
                  <MapPinned className="h-5 w-5 text-violet-600 shrink-0" />
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{d.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {reg?.name ?? translate('notSpecified')} · {ar?.name ? `${ar.name} · ` : ''}
                      {translate('geoDistrictLabel')}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex gap-2 pt-0">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(d)}>
                  <Edit className="h-4 w-4 mr-1" />
                  {translate('edit')}
                </Button>
                {canDeleteDistrict(d.id, stores) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{translate('deleteDistrictTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>{translate('deleteDistrictConfirm').replace('{name}', d.name)}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{translate('cancel')}</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => void doDelete(d)}>
                          {translate('delete')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <GeoPaginationBar page={page} totalPages={totalPages} translate={translate} setPage={setPage} />

      {filtered.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-gray-500">
            {search
              ? translate('noDistrictsSearch')
              : regions.length
                ? translate('noDistricts')
                : translate('noDistrictsNeedRegions')}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? translate('editDistrict') : translate('newDistrict')}</DialogTitle>
            <DialogDescription>{editing ? translate('editDistrictDesc') : translate('newDistrictDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-6 py-4">
            <div>
              <Label>{translate('geoRegionLabel')} *</Label>
              <SearchableSelect
                value={regionId}
                placeholder={translate('geoSelectRegion')}
                disabled={!regions.length}
                options={regions.map((r) => {
                  const ar = areaById.get(normId(r.areaId));
                  const label = ar ? `${r.name} (${ar.name})` : r.name;
                  return { value: r.id, label };
                })}
                onValueChange={(v) => {
                  setRegionId(v);
                  setFormErr((p) => ({ ...p, region: undefined }));
                }}
                aria-invalid={!!formErr.region}
                inputClassName={formErr.region ? 'border-red-500' : ''}
                zIndex={10000}
                maxListHeight="min(16rem, 55vh)"
              />
              {formErr.region && <p className="text-sm text-red-600 mt-1">{formErr.region}</p>}
            </div>
            <div>
              <Label htmlFor="districtName">{translate('geoNameLabel')}</Label>
              <Input
                id="districtName"
                value={name}
                maxLength={GEO_NAME_MAX}
                onChange={(e) => {
                  setName(e.target.value);
                  setFormErr((p) => ({ ...p, name: undefined }));
                }}
                className={formErr.name ? 'border-red-500' : ''}
              />
              {formErr.name && <p className="text-sm text-red-600 mt-1">{formErr.name}</p>}
              <p className="text-xs text-gray-500 mt-1">{translate('geoNameHint')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {translate('cancel')}
            </Button>
            <Button onClick={() => void save()} disabled={saving || !regions.length} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? translate('saving') : editing ? translate('update') : translate('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
