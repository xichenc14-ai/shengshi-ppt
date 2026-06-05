import path from 'node:path';
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { getThemeTokens } from '@/lib/theme/getThemeTokens';

type SlidePayload = {
  id?: string;
  title: string;
  content?: string[];
  notes?: string;
};

type SlidesPdfPayload = {
  title: string;
  slides: SlidePayload[];
  themeId?: string;
};

const FONT_FAMILY = 'ShengxinSans';
let fontRegistered = false;

function ensureFontRegistered() {
  if (fontRegistered) return;
  Font.register({
    family: FONT_FAMILY,
    src: path.join(process.cwd(), 'public/fonts/NotoSansCJKsc-Regular.otf'),
  });
  fontRegistered = true;
}

function createStyles(themeId: string) {
  const tokens = getThemeTokens(themeId);
  const primary = tokens.primary;
  const accent = tokens.accent;
  const background = tokens.background;
  const bodyText = tokens.isDark ? '#F8FAFC' : '#0F172A';
  const subtle = tokens.isDark ? 'rgba(248,250,252,0.72)' : '#475569';
  const cardBg = tokens.isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF';
  const cardBorder = tokens.isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0';

  return StyleSheet.create({
    page: {
      paddingTop: 34,
      paddingBottom: 34,
      paddingHorizontal: 42,
      fontFamily: FONT_FAMILY,
      backgroundColor: background,
      position: 'relative',
    },
    topBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 16,
      backgroundColor: primary,
    },
    footerLine: {
      position: 'absolute',
      left: 42,
      right: 42,
      bottom: 28,
      height: 1,
      backgroundColor: cardBorder,
    },
    pageNumber: {
      position: 'absolute',
      bottom: 10,
      right: 42,
      fontSize: 10,
      color: subtle,
    },
    deckTitle: {
      fontSize: 12,
      color: subtle,
      marginBottom: 18,
    },
    slideTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 22,
    },
    slideIndex: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: accent,
      color: tokens.textLight,
      fontSize: 12,
      textAlign: 'center',
      paddingTop: 6,
      fontWeight: 700,
    },
    slideTitle: {
      fontSize: 28,
      color: bodyText,
      fontWeight: 700,
      lineHeight: 1.25,
    },
    contentGrid: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      marginTop: 8,
    },
    bulletCard: {
      backgroundColor: cardBg,
      borderWidth: 1,
      borderColor: cardBorder,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    bulletDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: accent,
      marginTop: 8,
      flexShrink: 0,
    },
    bulletText: {
      flex: 1,
      fontSize: 17,
      lineHeight: 1.5,
      color: bodyText,
    },
    emptyCard: {
      backgroundColor: cardBg,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: cardBorder,
      borderRadius: 14,
      paddingVertical: 18,
      paddingHorizontal: 16,
    },
    emptyText: {
      fontSize: 15,
      color: subtle,
      textAlign: 'center',
    },
  });
}

function SlidesPdfDocument({ title, slides, themeId = 'consultant' }: SlidesPdfPayload) {
  const styles = createStyles(themeId);

  return (
    <Document title={title}>
      {slides.map((slide, index) => {
        const content = Array.isArray(slide.content)
          ? slide.content.filter((item) => String(item || '').trim()).slice(0, 8)
          : [];
        return (
          <Page key={slide.id || `${slide.title}-${index}`} size={[1280, 720]} style={styles.page}>
            <View style={styles.topBar} />
            <Text style={styles.deckTitle}>{title}</Text>
            <View style={styles.slideTitleRow}>
              <Text style={styles.slideIndex}>{index + 1}</Text>
              <Text style={styles.slideTitle}>{slide.title || `第 ${index + 1} 页`}</Text>
            </View>
            <View style={styles.contentGrid}>
              {content.length > 0 ? content.map((item, itemIndex) => (
                <View key={`${slide.id || index}-${itemIndex}`} style={styles.bulletCard}>
                  <View style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                </View>
              )) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>本页无正文要点</Text>
                </View>
              )}
            </View>
            <View style={styles.footerLine} />
            <Text style={styles.pageNumber}>{index + 1} / {slides.length}</Text>
          </Page>
        );
      })}
    </Document>
  );
}

export async function renderSlidesPdfBuffer(payload: SlidesPdfPayload): Promise<Buffer> {
  ensureFontRegistered();
  const doc = <SlidesPdfDocument {...payload} />;
  return await renderToBuffer(doc);
}
