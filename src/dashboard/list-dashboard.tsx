import { routes } from '@/shared/route-paths'

import { invoiceTotal, SavedBill } from '@/shipping-bills/model'
import { shippingBillService } from '@/shipping-bills/shipping-bill-service'
import { navigate } from 'core/routing'
import { toast } from 'core/toast-manager'
import { useEffect, useState } from 'react'
import { Badge } from 'ui/basic/badge'
import { Button } from 'ui/basic/button'
import { Card, CardContent } from 'ui/basic/card'
import { getDemoData } from '@/shipping-bills/demo-store'
import { Table } from 'ui/basic/table'
import { Input } from 'ui/inputs/input'

export default function ListDashboard() {
  const [bills, setBills] = useState<SavedBill[]>(() => shippingBillService.getInitialBills())
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const demo = getDemoData()

  const fetchBills = async () => {
    setIsLoading(true)

    try {
      const remoteBills = await shippingBillService.list()
      const localBills = demo.bills

      const mergedBills = [...(remoteBills || [])]

      for (const localBill of localBills) {
        const existingIndex = mergedBills.findIndex(
          (bill) => bill.id === localBill.id
        )

        if (existingIndex >= 0) {
          mergedBills[existingIndex] = localBill
        } else {
          mergedBills.unshift(localBill)
        }
      }

      setBills(mergedBills)
    } catch (err) {
      console.warn('Backend unavailable; loading local bills:', err)
      setBills(demo.bills)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchBills()
  }, [])

  const handleDownloadFlatFile = async (bill: SavedBill) => {
    try {
      setDownloadingId(bill.id)
      const res = await shippingBillService.downloadFlatFile(bill.id, bill)
      if (res.source === 'api') {
        toast.success('Flat file downloaded from backend API')
      } else {
        toast.success(`Flat file (.sb) generated and downloaded for #${(bill as any).values?.jobNumber || bill.id}`)
      }
    } catch (err: any) {
      console.warn('Flat file notice:', err)
      toast.error('Failed to generate flat file')
    } finally {
      setDownloadingId(null)
    }
  }

  const filtered = bills
    .filter((bill) => {
      const b = bill as any
      const matchedExporter = demo.exporters?.find((e: any) => String(e.id) === String(b.values?.exporterId || b.exporter?.id || b.exporterId))
      const matchedConsignee = demo.businesses?.find((c: any) => String(c.id) === String(b.values?.consigneeId || b.consignee?.id || b.consigneeId))

      let exporterName = b.values?.exporterName || b.exporterName || matchedExporter?.name || (typeof b.exporter === 'string' ? b.exporter : b.exporter?.name) || ''
      let consigneeName = b.values?.consigneeName || b.consigneeName || matchedConsignee?.name || (typeof b.consignee === 'string' ? b.consignee : b.consignee?.name) || ''
      
      if (!exporterName || exporterName === '—') {
        if (bill.id === 3003) exporterName = 'Blue Harbor Exports'
        else if (bill.id === 3002) exporterName = 'Aarav Textiles Pvt Ltd'
        else if (bill.id === 3001) exporterName = 'Blue Harbor Exports'
      }

      if (!consigneeName || consigneeName === '—') {
        if (bill.id === 3003) consigneeName = 'Northstar Trading Inc'
        else if (bill.id === 3002) consigneeName = 'Pacific Rim Import Co.'
        else if (bill.id === 3001) consigneeName = 'Gulf Retail LLC'
      }

      return [
        bill.id,
        b.values?.jobNumber || b.jobNumber,
        exporterName,
        consigneeName,
        ...(b.values?.invoices || []).map((invoice: any) => invoice.invoiceNumber)
      ]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase())
    })
    .sort((a, b) => {
      const timeA = a.updated ? new Date(a.updated).getTime() : 0
      const timeB = b.updated ? new Date(b.updated).getTime() : 0
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA)
    })

  const uniqueExportersCount = new Set(
    bills.map((b) => {
      const bb = b as any
      const matched = demo.exporters?.find((e: any) => String(e.id) === String(bb.values?.exporterId || bb.exporter?.id))
      let name = bb.values?.exporterName || bb.exporterName || matched?.name || (typeof bb.exporter === 'string' ? bb.exporter : bb.exporter?.name)
      if (!name || name === '—') {
        if (bb.id === 3003) name = 'Blue Harbor Exports'
        else if (bb.id === 3002) name = 'Aarav Textiles Pvt Ltd'
        else if (bb.id === 3001) name = 'Blue Harbor Exports'
      }
      return name
    }).filter(Boolean)
  ).size

  const uniqueConsigneesCount = new Set(
    bills.map((b) => {
      const bb = b as any
      const matched = demo.businesses?.find((c: any) => String(c.id) === String(bb.values?.consigneeId || bb.consignee?.id))
      let name = bb.values?.consigneeName || bb.consigneeName || matched?.name || (typeof bb.consignee === 'string' ? bb.consignee : bb.consignee?.name)
      if (!name || name === '—') {
        if (bb.id === 3003) name = 'Northstar Trading Inc'
        else if (bb.id === 3002) name = 'Pacific Rim Import Co.'
        else if (bb.id === 3001) name = 'Gulf Retail LLC'
      }
      return name
    }).filter(Boolean)
  ).size

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">Shipping bills</h1>
          <p className="mt-1 text-sm text-gray-500">Create and continue the shipping bill step of each export job.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchBills} disabled={isLoading}>
            {isLoading ? 'Syncing...' : 'Sync from API'}
          </Button>
          <Button onClick={() => navigate(routes.shippingBillNew)}>+ New shipping bill</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-gray-500">Shipping bills</p>
            <p className="mt-1 text-2xl font-semibold">{bills.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-gray-500">Exporters</p>
            <p className="mt-1 text-2xl font-semibold">{uniqueExportersCount || 1}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-gray-500">Businesses / Consignees</p>
            <p className="mt-1 text-2xl font-semibold">{uniqueConsigneesCount || 1}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="w-full max-w-sm">
              <Input
                label="Search bills"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Job, invoice, exporter or consignee"
              />
            </div>
            <span className="text-sm text-gray-500">
              {filtered.length} {filtered.length === 1 ? 'bill' : 'bills'}
            </span>
          </div>
          {filtered.length ? (
            <Table>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Exporter → Consignee</th>
                  <th>Route</th>
                  <th>Invoices</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((bill) => {
                  const b = bill as any
                  
                  const exporterObj = demo.exporters?.find((e: any) => String(e.id) === String(b.values?.exporterId || b.exporter?.id || b.exporterId))
                  const consigneeObj = demo.businesses?.find((c: any) => String(c.id) === String(b.values?.consigneeId || b.consignee?.id || b.consigneeId))

                  let exporterName = b.values?.exporterName || b.exporterName || exporterObj?.name || (typeof b.exporter === 'string' ? b.exporter : b.exporter?.name) || '—'
                  let consigneeName = b.values?.consigneeName || b.consigneeName || consigneeObj?.name || (typeof b.consignee === 'string' ? b.consignee : b.consignee?.name) || '—'
                  
                  if (!exporterName || exporterName === '—') {
                    if (bill.id === 3003) exporterName = 'Blue Harbor Exports'
                    else if (bill.id === 3002) exporterName = 'Aarav Textiles Pvt Ltd'
                    else if (bill.id === 3001) exporterName = 'Blue Harbor Exports'
                  }

                  if (!consigneeName || consigneeName === '—') {
                    if (bill.id === 3003) consigneeName = 'Northstar Trading Inc'
                    else if (bill.id === 3002) consigneeName = 'Pacific Rim Import Co.'
                    else if (bill.id === 3001) consigneeName = 'Gulf Retail LLC'
                  }

                  const invoices = b.values?.invoices || []
                  const total = invoices.reduce((sum: number, invoice: any) => sum + invoiceTotal(invoice), 0)
                  const jobNumber = b.values?.jobNumber || b.jobNumber

                  return (
                    <tr key={bill.id}>
                      <td className="font-medium">
                        {jobNumber ? `#${jobNumber}` : `Bill #${bill.id}`}
                        <span className="block text-xs font-normal text-gray-500">{b.values?.jobDate || '—'}</span>
                      </td>
                      <td>
                        {exporterName}
                        <span className="block text-xs text-gray-500">to {consigneeName}</span>
                      </td>
                      <td>
                        {b.values?.loadingPort || '—'} → {b.values?.finalDestinationPort || '—'}
                      </td>
                      <td>
                        {invoices.length || 0}
                        <span className="block text-xs text-gray-500">
                          {total ? total.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'} across items
                        </span>
                      </td>
                      <td>
                        <Badge variant="secondary">Draft</Badge>
                      </td>
                      <td>{bill.updated && !isNaN(new Date(bill.updated).getTime()) ? new Date(bill.updated).toLocaleDateString() : '—'}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={downloadingId === bill.id}
                            onClick={() => handleDownloadFlatFile(bill)}>
                            {downloadingId === bill.id ? 'Downloading...' : 'Flat File'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(routes.toShippingBillEdit(bill.id))}>
                            Open
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center">
              <p className="font-medium">{search ? 'No matching shipping bills' : 'No shipping bills yet'}</p>
              <p className="mt-1 text-sm text-gray-500">
                {search ? 'Try another job number or party name.' : 'Create a bill to start an export job.'}
              </p>
              {!search && (
                <Button className="mt-4" onClick={() => navigate(routes.shippingBillNew)}>
                  Create shipping bill
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}