import type { MenuCategory, MenuData, MenuItem } from './menu.types'

const navy = '#082a59'
const paper = '#fffefa'
const rule = '#8fa3c1'
const templateUrl = '/templates/captain-jimmys-menu-template.png'

type PdfNode = Record<string, unknown>

function visibleItems(category: MenuCategory) {
  return category.items.filter((item) => !item.hidden)
}

type PageColumns = {
  left: MenuCategory[]
  right: MenuCategory[]
}

function categorySegment(category: MenuCategory, items: MenuItem[], title = category.title): MenuCategory {
  return { ...category, title, items }
}

function buildTwoPages(menu: MenuData): [PageColumns, PageColumns] {
  const categories = menu.categories
  const secondPageLeft = categories[2] ? [categories[2]] : []
  const secondPageRight = categories.slice(3)

  if (secondPageLeft.length && secondPageRight.length) {
    const lastCategory = secondPageRight[secondPageRight.length - 1]
    const precedingRight = secondPageRight.slice(0, -1)
    const movableItems = visibleItems(lastCategory)
    const leftLoad = visibleItems(secondPageLeft[0]).length + 3
    const rightFixedLoad = precedingRight.reduce((total, category) => total + visibleItems(category).length + 3, 0)
    const moveCount = Math.max(0, Math.min(movableItems.length - 1, Math.round((rightFixedLoad + movableItems.length - leftLoad) / 2)))

    if (moveCount > 0) {
      const continuation = menu.id === 'el' ? 'ΣΥΝΕΧΕΙΑ' : 'CONTINUED'
      const useGreekDrinkOrder = menu.id === 'el' && movableItems.length >= 7
      const leftItems = useGreekDrinkOrder
        ? [...movableItems.slice(-3), ...movableItems.slice(0, 3)]
        : movableItems.slice(0, moveCount)
      const rightItems = useGreekDrinkOrder
        ? movableItems.slice(3, -3)
        : movableItems.slice(moveCount)

      secondPageLeft.push(categorySegment(lastCategory, leftItems))
      secondPageRight.splice(
        0,
        secondPageRight.length,
        ...precedingRight,
        categorySegment(lastCategory, rightItems, `${lastCategory.title} - ${continuation}`),
      )
    }
  }

  return [
    {
      left: categories[0] ? [categories[0]] : [],
      right: categories[1] ? [categories[1]] : [],
    },
    {
      left: secondPageLeft,
      right: secondPageRight,
    },
  ]
}

function dishNode(item: MenuItem): PdfNode {
  const displayPrice = [item.pricePrefix?.trim(), item.price.trim()].filter(Boolean).join(' ')

  return {
    unbreakable: true,
    margin: [0, 0, 0, 2.5],
    columns: [
      {
        width: '*',
        stack: [
          { text: item.name, style: 'dishName' },
          ...(item.description ? [{ text: item.description, style: 'description', margin: [0, 1, 0, 0] }] : []),
        ],
      },
      { text: displayPrice, width: 37, alignment: 'right', style: 'price' },
    ],
    columnGap: 8,
  }
}

function ornament(): PdfNode {
  return {
    canvas: [
      { type: 'line', x1: 0, y1: 0, x2: 82, y2: 0, lineWidth: 0.7, lineColor: rule },
      { type: 'line', x1: 132, y1: 0, x2: 214, y2: 0, lineWidth: 0.7, lineColor: rule },
      {
        type: 'polyline',
        points: [{ x: 105, y: -4 }, { x: 109, y: 0 }, { x: 105, y: 4 }, { x: 101, y: 0 }],
        closePath: true,
        lineWidth: 1,
        lineColor: navy,
      },
    ],
    margin: [0, 5, 0, 9],
  }
}

function categoryNode(category: MenuCategory): PdfNode {
  return {
    width: '*',
    margin: [0, 0, 0, 11],
    stack: [
      { text: category.title, style: 'categoryTitle' },
      ornament(),
      ...visibleItems(category).map(dishNode),
    ],
  }
}

function divider(topMargin = 8): PdfNode {
  return {
    width: 1,
    margin: [0, topMargin, 0, 0],
    canvas: [
      { type: 'line', x1: 0, y1: 0, x2: 0, y2: 462, lineWidth: 0.8, lineColor: navy },
      {
        type: 'polyline',
        points: [{ x: 0, y: -7 }, { x: 3, y: -3 }, { x: 0, y: 1 }, { x: -3, y: -3 }],
        closePath: true,
        lineWidth: 0.8,
        lineColor: navy,
      },
      {
        type: 'polyline',
        points: [{ x: 0, y: 461 }, { x: 3, y: 465 }, { x: 0, y: 469 }, { x: -3, y: 465 }],
        closePath: true,
        lineWidth: 0.8,
        lineColor: navy,
      },
    ],
  }
}

function pageBody(page: PageColumns): PdfNode {
  return {
    columns: [
      { width: '*', stack: page.left.map(categoryNode) },
      divider(),
      { width: '*', stack: page.right.map(categoryNode) },
    ],
    columnGap: 20,
  }
}

function templateBackground(
  pageSize: { width: number; height: number },
  menu: MenuData,
  greekTitleNavyPatch?: string,
): PdfNode[] {
  const maskTop = pageSize.height * (395 / 1491)
  const maskBottom = pageSize.height * (1300 / 1491)
  const greekBreadLabelTop = pageSize.height * (1325 / 1491)
  const greekBreadLabelHeight = pageSize.height * (48 / 1491)
  const greekSubtitleTop = pageSize.height * (150 / 1491)
  const greekNoteTop = pageSize.height * (1390 / 1491)

  const background: PdfNode[] = [
    {
      image: 'menuTemplate',
      width: pageSize.width,
      height: pageSize.height,
      absolutePosition: { x: 0, y: 0 },
    },
    {
      canvas: [
        {
          type: 'rect',
          x: pageSize.width * (42 / 1055),
          y: maskTop,
          w: pageSize.width * ((1055 - 84) / 1055),
          h: maskBottom - maskTop,
          color: paper,
        },
        ...(menu.id === 'el' ? [
          {
            type: 'rect',
            x: pageSize.width * (320 / 1055),
            y: greekSubtitleTop,
            w: pageSize.width * (415 / 1055),
            h: pageSize.height * (62 / 1491),
            color: paper,
          },
          {
            type: 'rect',
            x: pageSize.width * (270 / 1055),
            y: greekBreadLabelTop,
            w: pageSize.width * (515 / 1055),
            h: greekBreadLabelHeight,
            color: paper,
          },
          {
            type: 'rect',
            x: pageSize.width * (255 / 1055),
            y: greekNoteTop,
            w: pageSize.width * (545 / 1055),
            h: pageSize.height * (65 / 1491),
            color: paper,
          },
        ] : []),
      ],
      absolutePosition: { x: 0, y: 0 },
    },
  ]

  if (menu.id === 'el') {
    if (greekTitleNavyPatch) {
      background.push({
        image: 'greekTitleNavyPatch',
        width: pageSize.width * (415 / 1055),
        height: pageSize.height * (90 / 1491),
        absolutePosition: {
          x: pageSize.width * (320 / 1055),
          y: pageSize.height * (140 / 1491),
        },
      })
    }

    background.push(
      {
        text: menu.subtitle ?? 'Παραδοσιακή Ελληνική Κουζίνα',
        width: pageSize.width,
        absolutePosition: {
          x: 0,
          y: pageSize.height * (158 / 1491),
        },
        alignment: 'center',
        color: '#9a693e',
        font: 'NotoSerif',
        fontSize: 12.6,
        italics: true,
      },
      {
        text: 'ΨΩΜΙ ΚΑΤΑ ΑΤΟΜΟ - 0,50',
        width: pageSize.width,
        absolutePosition: { x: 0, y: pageSize.height * (1330 / 1491) },
        alignment: 'center',
        color: navy,
        font: 'NotoSerif',
        fontSize: 14.5,
        bold: true,
        characterSpacing: 0.35,
      },
      {
        text: (menu.note ?? 'Όλα τα φαγητά μαγειρεύονται με έξτρα παρθένο βιολογικό ελαιόλαδο παραγωγής μας.')
          .replace(' βιολογικό ', '\nβιολογικό '),
        width: pageSize.width,
        absolutePosition: {
          x: 0,
          y: pageSize.height * (1395 / 1491),
        },
        alignment: 'center',
        color: navy,
        font: 'NotoSerif',
        fontSize: 10.2,
        italics: true,
        lineHeight: 1.08,
      },
    )
  }

  return background
}

function buildDocument(menu: MenuData, templateDataUrl: string, greekTitleNavyPatch?: string) {
  const pages = buildTwoPages(menu)

  return {
    pageSize: 'A4',
    pageMargins: [55, 235, 55, 72],
    background: (_currentPage: number, pageSize: { width: number; height: number }) => (
      templateBackground(pageSize, menu, greekTitleNavyPatch)
    ),
    defaultStyle: {
      font: 'NotoSerif',
      color: navy,
    },
    images: {
      menuTemplate: templateDataUrl,
      ...(greekTitleNavyPatch ? { greekTitleNavyPatch } : {}),
    },
    content: pages.map((page, index) => ({
      pageBreak: index > 0 ? 'before' : undefined,
      stack: [pageBody(page)],
    })),
    styles: {
      categoryTitle: {
        alignment: 'center',
        fontSize: 15.5,
        bold: true,
        characterSpacing: 0.8,
      },
      dishName: {
        fontSize: 8.35,
        lineHeight: 1.02,
      },
      price: {
        fontSize: 8.35,
        lineHeight: 1.02,
      },
      description: {
        color: '#6b6258',
        fontSize: 7,
        italics: true,
        lineHeight: 1.05,
      },
    },
    info: {
      title: `${menu.restaurant} ${menu.language} menu`,
      author: menu.restaurant,
      subject: 'Restaurant menu',
    },
  }
}

async function assetAsBase64(url: string) {
  const response = await fetch(`${url}?v=3`)
  if (!response.ok) throw new Error(`Could not load PDF asset: ${url}`)

  const bytes = new Uint8Array(await response.arrayBuffer())
  let binary = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

async function extractNavyTitlePatch(templateDataUrl: string) {
  const region = { x: 320, y: 140, width: 415, height: 90 }
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const source = new Image()
    source.onload = () => resolve(source)
    source.onerror = () => reject(new Error('Could not prepare the Greek PDF title'))
    source.src = templateDataUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = region.width
  canvas.height = region.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare the Greek PDF title')

  context.drawImage(
    image,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    region.width,
    region.height,
  )

  const pixels = context.getImageData(0, 0, region.width, region.height)
  for (let index = 0; index < pixels.data.length; index += 4) {
    const red = pixels.data[index]
    const green = pixels.data[index + 1]
    const blue = pixels.data[index + 2]
    const isNavyArtwork = blue > red + 10 && blue > green + 6
    if (!isNavyArtwork) pixels.data[index + 3] = 0
  }
  context.putImageData(pixels, 0, 0)

  return canvas.toDataURL('image/png')
}

export async function downloadMenuPdf(menu: MenuData) {
  const [{ default: pdfMake }, regular, bold, italic, template] = await Promise.all([
    import('pdfmake/build/pdfmake.js'),
    assetAsBase64('/fonts/NotoSerif-Regular.ttf'),
    assetAsBase64('/fonts/NotoSerif-Bold.ttf'),
    assetAsBase64('/fonts/NotoSerif-Italic.ttf'),
    assetAsBase64(templateUrl),
  ])

  pdfMake.addVirtualFileSystem({
    'NotoSerif-Regular.ttf': regular,
    'NotoSerif-Bold.ttf': bold,
    'NotoSerif-Italic.ttf': italic,
  })
  pdfMake.addFonts({
    NotoSerif: {
      normal: 'NotoSerif-Regular.ttf',
      bold: 'NotoSerif-Bold.ttf',
      italics: 'NotoSerif-Italic.ttf',
      bolditalics: 'NotoSerif-Bold.ttf',
    },
  })

  const templateDataUrl = `data:image/png;base64,${template}`
  const greekTitleNavyPatch = menu.id === 'el'
    ? await extractNavyTitlePatch(templateDataUrl)
    : undefined
  pdfMake.createPdf(buildDocument(menu, templateDataUrl, greekTitleNavyPatch))
    .download(`captain-jimmys-menu-${menu.id}.pdf`)
}
