import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.parser.PdfTextExtractor;

/** Extracts synthetic integration PDFs with the same OpenPDF version used by the backend. */
public final class PdfTextProbe {
    public static void main(String[] args) throws Exception {
        if (args.length != 0) throw new IllegalArgumentException("PDF bytes must be supplied on stdin");
        PdfReader reader = new PdfReader(System.in);
        try {
            PdfTextExtractor extractor = new PdfTextExtractor(reader);
            for (int page = 1; page <= reader.getNumberOfPages(); page++) {
                System.out.println(extractor.getTextFromPage(page));
            }
        } finally {
            reader.close();
        }
    }
}
