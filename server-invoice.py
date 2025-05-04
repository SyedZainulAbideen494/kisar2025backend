from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from docx import Document
from num2words import num2words
import os
import smtplib
from email.mime.text import MIMEText
import html

app = FastAPI()

# Pydantic models for request validation
class Item(BaseModel):
    description: str
    sacCode: str
    amount: str  # Kept as str to match input, will parse to float

class InvoiceRequest(BaseModel):
    date: str
    invoiceNo: str
    billTo: str
    instamojoPaymentId: str
    items: list[Item]
    email: str
    fees: str  # Field for Instamojo fees

class UpgradeInvoiceRequest(BaseModel):
    billTo: str
    email: str
    instamojoPaymentId: str
    packageName: str
    amount: str

@app.post("/api/generate-invoice")
async def generate_invoice(request: InvoiceRequest):
    try:
        # Extract data from request
        date = request.date
        invoice_no = request.invoiceNo
        bill_to = request.billTo
        instamojo_payment_id = request.instamojoPaymentId
        items = request.items
        recipient_email = "mohammedfaisal3366@gmail.com"
        instamojo_fees = float(request.fees)  # Fees are already in INR

        # Calculate totals
        basic_value = sum(float(item.amount) for item in items)
        taxable_value = basic_value
        cgst_rate = 0.09  # 9% CGST
        sgst_rate = 0.09  # 9% SGST
        igst_rate = 0.0   # 0% IGST
        cgst = taxable_value * cgst_rate
        sgst = taxable_value * sgst_rate
        igst = taxable_value * igst_rate
        total_tax = cgst + sgst + igst
        subtotal = taxable_value
        total = taxable_value + total_tax
        grand_total = total + instamojo_fees
        amount_in_words = num2words(grand_total, lang='en').replace(',', '').title() + " Rupees Only"

        # Create DOCX document
        doc = Document()

        # Header
        doc.add_heading("Karnataka Chapter of The India Society for Assisted Reproduction", level=2).alignment = 1  # Center
        doc.add_paragraph("No.1, 1st Floor, UMA Admiralty,\nBannerugatta Road, Bangalore - 560029.\nGSTIN: 29AABAK4261H2ZL", style='Normal').alignment = 1

        # Invoice Details
        doc.add_heading("GST INVOICE", level=3)
        doc.add_paragraph(f"DATE: {date}")
        doc.add_paragraph(f"INVOICE NO: {invoice_no}")
        doc.add_paragraph("10TH ANNUAL CONFERENCE KISAR-2025")

        # Bill To
        doc.add_paragraph("BILL TO", style='Normal').runs[0].bold = True
        doc.add_paragraph(bill_to)

        # Instamojo Payment ID
        doc.add_paragraph(f"Instamojo Payment ID: {instamojo_payment_id}")

        # Items Table
        items_table = doc.add_table(rows=1, cols=3)
        items_table.style = 'Table Grid'
        hdr_cells = items_table.rows[0].cells
        hdr_cells[0].text = "DESCRIPTION"
        hdr_cells[1].text = "SAC Code"
        hdr_cells[2].text = "Amount in Rs."
        for cell in hdr_cells:
            cell.paragraphs[0].runs[0].bold = True

        for item in items:
            row_cells = items_table.add_row().cells
            row_cells[0].text = item.description
            row_cells[1].text = item.sacCode
            row_cells[2].text = f"{float(item.amount):.2f}"

        # Spacer paragraph before totals table
        doc.add_paragraph("", style='Normal').paragraph_format.space_after = 240  # Approx 12pt spacing

        # Totals Table (Includes all requested fields)
        totals_table = doc.add_table(rows=10, cols=2)
        totals_table.style = 'Table Grid'
        totals_table.autofit = False
        totals_table.columns[0].width = 3000000  # Approx 50% width
        totals_table.columns[1].width = 3000000
        totals_table.alignment = 2  # Right align

        totals_data = [
            ("Basic Value:", f"₹{basic_value:.2f}"),
            ("Taxable Value:", f"₹{taxable_value:.2f}"),
            ("CGST (9%):", f"₹{cgst:.2f}"),
            ("SGST (9%):", f"₹{sgst:.2f}"),
            ("IGST (0%):", f"₹{igst:.2f}"),
            ("Total Tax:", f"₹{total_tax:.2f}"),
            ("Subtotal:", f"₹{subtotal:.2f}"),
            ("Total:", f"₹{total:.2f}"),
            ("Payment Gateway Fee (Instamojo):", f"₹{instamojo_fees:.2f}"),
            ("Grand Total:", f"₹{grand_total:.2f}"),
        ]

        for i, (label, value) in enumerate(totals_data):
            row_cells = totals_table.rows[i].cells
            row_cells[0].text = label
            row_cells[1].text = value
            row_cells[1].paragraphs[0].alignment = 2  # Right align value
            if label in ["Total:", "Grand Total:"]:
                row_cells[0].paragraphs[0].runs[0].bold = True
                row_cells[1].paragraphs[0].runs[0].bold = True

        # Spacer paragraph before Amount in Words
        doc.add_paragraph("", style='Normal').paragraph_format.space_after = 480  # Approx 24pt spacing

        # Amount in Words
        doc.add_paragraph(f"Amount in Words: {amount_in_words}")

        # Remittance Section
        doc.add_paragraph("Please Remit the Amount to Below Account Number", style='Normal').runs[0].bold = True
        doc.add_paragraph("Saving A/c No.: 029901005524")
        doc.add_paragraph("ICICI Bank, Jayanagar 9th Block Bangalore")
        doc.add_paragraph("IFSC Code: ICICI0000299")
        doc.add_paragraph("PAN: AABAK4261H")

        # Save the document
        sanitized_bill_to = "".join(c if c.isalnum() else "_" for c in bill_to)
        filename = f"{sanitized_bill_to}_{instamojo_payment_id}.docx"
        folder_path = os.path.join(os.getcwd(), "invoices","new")
        os.makedirs(folder_path, exist_ok=True)
        file_path = os.path.join(folder_path, filename)

        doc.save(file_path)

        # Send confirmation email with updated HTML/CSS template
        sender_email = "labslyxn@gmail.com"
        sender_password = "iwjnveuscunamwgs"
        cc_email = "mfaisal.pla@gmail.com"

        # Generate items table for email
        items_html = "".join(
            f"""
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">{item.description}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹{float(item.amount):.2f}</td>
            </tr>
            """ for item in items
        )

        # Email template with all fields
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    background-color: #f4f4f4;
                    margin: 0;
                    padding: 0;
                }}
                .container {{
                    max-width: 600px;
                    margin: 20px auto;
                    background-color: #ffffff;
                    border-radius: 10px;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                }}
                .header {{
                    background-color: #4CAF50;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    border-top-left-radius: 10px;
                    border-top-right-radius: 10px;
                }}
                .content {{
                    padding: 20px;
                }}
                .footer {{
                    background-color: #f4f4f4;
                    padding: 10px;
                    text-align: center;
                    font-size: 12px;
                    color: #666;
                }}
                table {{
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                }}
                th, td {{
                    padding: 10px;
                    text-align: left;
                }}
                th {{
                    background-color: #f0f0f0;
                    font-weight: bold;
                }}
                .total {{
                    font-weight: bold;
                    font-size: 16px;
                }}
                .payment-id {{
                    font-size: 14px;
                    color: #333;
                    margin-top: 10px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Thank You for Registering!</h2>
                </div>
                <div class="content">
                    <p>Dear {bill_to},</p>
                    <p>Thank you for registering for the <strong>10th Annual Conference 2025 - KISAR</strong>. Below are your registration details:</p>
                    <table>
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items_html}
                        </tbody>
                    </table>
                    <table>
                        <tr>
                            <td style="padding: 10px;">Subtotal:</td>
                            <td style="padding: 10px; text-align: right;">₹{subtotal:.2f}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px;">CGST (9%):</td>
                            <td style="padding: 10px; text-align: right;">₹{cgst:.2f}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px;">SGST (9%):</td>
                            <td style="padding: 10px; text-align: right;">₹{sgst:.2f}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px;">Total:</td>
                            <td style="padding: 10px; text-align: right; font-weight: bold;">₹{total:.2f}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px;">Payment Gateway Fee (Instamojo):</td>
                            <td style="padding: 10px; text-align: right;">₹{instamojo_fees:.2f}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px;">Grand Total:</td>
                            <td style="padding: 10px; text-align: right; font-weight: bold;">₹{grand_total:.2f}</td>
                        </tr>
                    </table>
                    <p class="payment-id">Instamojo Payment ID: {instamojo_payment_id}</p>
                    <p>We look forward to seeing you at the event!</p>
                    <p>Best regards,<br>Karnataka Chapter of ISAR</p>
                </div>
                <div class="footer">
                    <p>Contact us at: kisar.office@gmail.com | © 2025 KISAR</p>
                    <p>Powered By: © LYXN LABS</p>
                </div>
            </div>
        </body>
        </html>
        """

        msg = MIMEText(html_content, 'html')
        msg['From'] = sender_email
        msg['To'] = "mohammedfaisal3366@gmail.com"
        msg['Cc'] = cc_email
        msg['Subject'] = "Registration Confirmation - 10th Annual Conference 2025 KISAR"

        recipients = [recipient_email, cc_email]

        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, recipients, msg.as_string())

        return {"status": "OK"}

    except Exception as e:
        print(f"Error generating invoice: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate invoice")

@app.post("/api/generate-upgrade-invoice")
async def generate_upgrade_invoice(request: UpgradeInvoiceRequest):
    try:
        # Extract data from request
        bill_to = request.billTo
        recipient_email = request.email
        instamojo_payment_id = request.instamojoPaymentId
        package_name = request.packageName
        amount = float(request.amount)

        # Calculate totals (upgrade amount is the paid difference, no GST applied)
        grand_total = amount

        # Send confirmation email with stylish HTML/CSS template
        sender_email = "labslyxn@gmail.com"
        sender_password = "iwjnveuscunamwgs"
        cc_email = "mfaisal.pla@gmail.com"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    background-color: #f4f4f4;
                    margin: 0;
                    padding: 0;
                }}
                .container {{
                    max-width: 600px;
                    margin: 20px auto;
                    background-color: #ffffff;
                    border-radius: 10px;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                }}
                .header {{
                    background-color: #4CAF50;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    border-top-left-radius: 10px;
                    border-top-right-radius: 10px;
                }}
                .content {{
                    padding: 20px;
                }}
                .footer {{
                    background-color: #f4f4f4;
                    padding: 10px;
                    text-align: center;
                    font-size: 12px;
                    color: #666;
                }}
                table {{
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                }}
                th, td {{
                    padding: 10px;
                    text-align

: left;
                }}
                th {{
                    background-color: #f0f0f0;
                    font-weight: bold;
                }}
                .total {{
                    font-weight: bold;
                    font-size: 16px;
                }}
                .payment-id {{
                    font-size: 14px;
                    color: #333;
                    margin-top: 10px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Package Upgrade Confirmation</h2>
                </div>
                <div class="content">
                    <p>Dear {bill_to},</p>
                    <p>Your package for the <strong>10th Annual Conference 2025 - KISAR</strong> has been successfully upgraded. Below are the details:</p>
                    <table>
                        <thead>
                            <tr>
                                <th>Package</th>
                                <th>Amount Paid</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #eee;">{package_name}</td>
                                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹{amount:.2f}</td>
                            </tr>
                        </tbody>
                    </table>
                    <p class="payment-id">Instamojo Payment ID: {instamojo_payment_id}</p>
                    <p class="total">Total Amount Paid: ₹{grand_total:.2f}</p>
                    <p>Thank you for your continued participation. We look forward to seeing you at the event!</p>
                    <p>Best regards,<br>Karnataka Chapter of ISAR</p>
                </div>
                <div class="footer">
                    <p>Contact us at: kisar.office@gmail.com | © 2025 KISAR</p>
                    <p>Powered By: © LYXN LABS</p>
                </div>
            </div>
        </body>
        </html>
        """

        msg = MIMEText(html_content, 'html')
        msg['From'] = sender_email
        msg['To'] = recipient_email
        msg['Cc'] = cc_email
        msg['Subject'] = "Package Upgrade Confirmation - 10th Annual Conference 2025 KISAR"

        recipients = [recipient_email, cc_email]

        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, recipients, msg.as_string())

        return {"status": "OK"}

    except Exception as e:
        print(f"Error generating upgrade invoice: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate upgrade invoice")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=4000)