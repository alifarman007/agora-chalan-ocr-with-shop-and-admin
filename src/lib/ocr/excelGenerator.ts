/**
 * Excel export — ported from the approved app (agoraOCR @ b54ac32).
 *
 * The WORKBOOK LAYOUT IS APPROVED: sheet name, merged title, header blocks, borders,
 * the FFF0F0F0 fill, summary placement, the auto-width rule and the filename pattern
 * must all stay exactly as they are.
 *
 * Only two things changed in the port:
 *   1. `file-saver` is gone (it is not installed). The download now uses
 *      URL.createObjectURL plus a temporary <a download>, which produces the same file.
 *   2. Types are imported from '@/types/delivery-chalan' and the callbacks are typed,
 *      because this project runs TypeScript in strict mode.
 */
import ExcelJS from 'exceljs'
import type {
  ColumnDefinition,
  DeliveryChalanDocument,
  LineItemRow,
  MetadataField,
  SummaryField,
} from '@/types/delivery-chalan'

export const generateExcel = async (data: DeliveryChalanDocument) => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Delivery Chalan')

  // Set default column width
  worksheet.properties.defaultColWidth = 15

  // --- 1. TITLE ---
  worksheet.mergeCells('A1:H2')
  const titleCell = worksheet.getCell('A1')
  titleCell.value = 'DELIVERY CHALAN'
  titleCell.font = { name: 'Arial', size: 16, bold: true }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }

  let currentRow = 4

  // --- 2. HEADER INFO (Supplier & Chalan Details) ---
  worksheet.getCell(`A${currentRow}`).value = 'Supplier:'
  worksheet.getCell(`A${currentRow}`).font = { bold: true }
  worksheet.getCell(`B${currentRow}`).value = data.supplier?.name || ''

  worksheet.getCell(`F${currentRow}`).value = 'Chalan No:'
  worksheet.getCell(`F${currentRow}`).font = { bold: true }
  worksheet.getCell(`G${currentRow}`).value = data.chalan_number || ''
  currentRow++

  worksheet.getCell(`A${currentRow}`).value = 'Address:'
  worksheet.getCell(`A${currentRow}`).font = { bold: true }
  worksheet.getCell(`B${currentRow}`).value = data.supplier?.address || ''

  worksheet.getCell(`F${currentRow}`).value = 'Date:'
  worksheet.getCell(`F${currentRow}`).font = { bold: true }
  worksheet.getCell(`G${currentRow}`).value = data.date || ''
  currentRow++

  worksheet.getCell(`A${currentRow}`).value = 'Phone:'
  worksheet.getCell(`A${currentRow}`).font = { bold: true }
  worksheet.getCell(`B${currentRow}`).value = data.supplier?.phone || ''

  worksheet.getCell(`F${currentRow}`).value = 'PO No:'
  worksheet.getCell(`F${currentRow}`).font = { bold: true }
  worksheet.getCell(`G${currentRow}`).value = data.po_number || ''
  currentRow += 2

  // --- 3. BUYER INFO ---
  worksheet.getCell(`A${currentRow}`).value = 'Buyer:'
  worksheet.getCell(`A${currentRow}`).font = { bold: true }
  worksheet.getCell(`B${currentRow}`).value = data.buyer?.name || ''
  currentRow++

  worksheet.getCell(`A${currentRow}`).value = 'Address:'
  worksheet.getCell(`A${currentRow}`).font = { bold: true }
  worksheet.getCell(`B${currentRow}`).value = data.buyer?.address || ''
  currentRow++

  worksheet.getCell(`A${currentRow}`).value = 'Phone:'
  worksheet.getCell(`A${currentRow}`).font = { bold: true }
  worksheet.getCell(`B${currentRow}`).value = data.buyer?.phone || ''
  currentRow++

  if (data.delivery_address) {
    worksheet.getCell(`A${currentRow}`).value = 'Delivery Addr:'
    worksheet.getCell(`A${currentRow}`).font = { bold: true }
    worksheet.getCell(`B${currentRow}`).value = data.delivery_address || ''
    currentRow++
  }
  currentRow++

  // --- 4. LINE ITEMS TABLE ---
  const columns: ColumnDefinition[] = data.line_items?.columns ?? []
  const rows: LineItemRow[] = data.line_items?.rows ?? []

  // Table Headers
  const headerRow = worksheet.getRow(currentRow)
  columns.forEach((col: ColumnDefinition, index: number) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = col.label
    cell.font = { bold: true }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F0F0' },
    }
  })
  currentRow++

  // Table Rows
  rows.forEach((row: LineItemRow) => {
    const dataRow = worksheet.getRow(currentRow)
    columns.forEach((col: ColumnDefinition, index: number) => {
      const cell = dataRow.getCell(index + 1)
      cell.value = row.cells[col.id] || ''
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      }
      if (col.type === 'number' || col.type === 'currency') {
        cell.alignment = { horizontal: 'right' }
      }
    })
    currentRow++
  })
  currentRow++

  // --- 5. SUMMARY / TOTALS ---
  if (data.summary && data.summary.length > 0) {
    const summaryStartCol = Math.max(1, columns.length - 1)
    data.summary.forEach((item: SummaryField) => {
      worksheet.getCell(currentRow, summaryStartCol).value = item.key
      worksheet.getCell(currentRow, summaryStartCol).font = { bold: true }

      const valCell = worksheet.getCell(currentRow, summaryStartCol + 1)
      valCell.value = item.value
      valCell.alignment = { horizontal: 'right' }
      valCell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      }
      currentRow++
    })
  }
  currentRow++

  // --- 6. ADDITIONAL METADATA ---
  if (data.additional_metadata && data.additional_metadata.length > 0) {
    worksheet.getCell(`A${currentRow}`).value = 'Additional Information:'
    worksheet.getCell(`A${currentRow}`).font = { bold: true, underline: true }
    currentRow++

    data.additional_metadata.forEach((item: MetadataField) => {
      worksheet.getCell(`A${currentRow}`).value = item.key + ':'
      worksheet.getCell(`A${currentRow}`).font = { bold: true }
      worksheet.getCell(`B${currentRow}`).value = item.value
      currentRow++
    })
  }

  // Adjust column widths based on content
  worksheet.columns.forEach((column) => {
    let maxLength = 0
    column.eachCell!({ includeEmpty: true }, (cell) => {
      const columnLength = cell.value ? cell.value.toString().length : 10
      if (columnLength > maxLength) {
        maxLength = columnLength
      }
    })
    column.width = maxLength < 10 ? 10 : maxLength + 2
  })

  // Generate and save file.
  // PORT CHANGE: file-saver replaced with createObjectURL. Same bytes, same filename.
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const filename = `Delivery_Chalan_${data.chalan_number || 'Export'}.xlsx`
  downloadBlob(blob, filename)
}

/** Replaces file-saver's saveAs. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = window.document.createElement('a')
  a.href = url
  // A chalan number can contain "/", which is not valid in a filename.
  a.download = filename.replace(/[\\/:*?"<>|]/g, '-')
  window.document.body.appendChild(a)
  a.click()
  a.remove()
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
