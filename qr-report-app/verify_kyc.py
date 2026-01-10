import csv

# 1. Read CSV
csv_path = r'd:\DEVELOPMENT REPORTS\QR-REPORT\qr-report-app\SupervisorKYC (2).csv'
csv_supervisors = []

try:
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader, None)
        for row in reader:
            if len(row) >= 5:
                # "S.No.","Employee Display ID","Employee Name","Employee Mobile Number","Customer Count"
                # row[1] is ID, row[2] is Name
                csv_supervisors.append({
                    'empId': row[1].strip(),
                    'name': row[2].strip()
                })
except Exception as e:
    print(f"Error reading CSV: {e}")

# 2. Master Data
MASTER_SUPERVISORS = [
    { "sNo": "1", "empId": "MVSID890", "department": "UCC", "name": "Sumit Khare" },
    { "sNo": "2", "empId": "MVSID1714", "department": "UCC", "name": "Nirmla" },
    { "sNo": "3", "empId": "MVSID912", "department": "UCC", "name": "Vishal Singh" },
    { "sNo": "4", "empId": "MVSID891", "department": "UCC", "name": "Devendri" },
    { "sNo": "5", "empId": "MVSID906", "department": "UCC", "name": "Vishnu Kumar" },
    { "sNo": "6", "empId": "MVSID949", "department": "UCC", "name": "Krishna Kumar Kashyap" },
    { "sNo": "7", "empId": "MVSID931", "department": "UCC", "name": "Lata Singh" },
    { "sNo": "8", "empId": "MVSID886", "department": "UCC", "name": "Abhishek Singh" },
    { "sNo": "9", "empId": "MVSID864", "department": "UCC", "name": "Kanchan Mahour" },
    { "sNo": "10", "empId": "MVSID914", "department": "UCC", "name": "Akash" },
    { "sNo": "11", "empId": "MVSID952", "department": "UCC", "name": "Sachin Kumar Dhangar" },
    { "sNo": "12", "empId": "MVSID905", "department": "UCC", "name": "Deepak Kumar Sharma" },
    { "sNo": "13", "empId": "MVSID921", "department": "UCC", "name": "Somdatta Braham" },
    { "sNo": "14", "empId": "MVSID910", "department": "UCC", "name": "Yogesh Devi" },
    { "sNo": "15", "empId": "MVSID1715", "department": "UCC", "name": "Suman Singh" },
    { "sNo": "16", "empId": "MVSID883", "department": "UCC", "name": "Jatin Chauhan" },
    { "sNo": "17", "empId": "MVSID878", "department": "UCC", "name": "Manvendra Singh" },
    { "sNo": "18", "empId": "MVSID942", "department": "UCC", "name": "Shivam" },
    { "sNo": "19", "empId": "MVSID903", "department": "UCC", "name": "Sundar Singh" },
    { "sNo": "20", "empId": "MVSID893", "department": "UCC", "name": "Jaya Sharma" },
    { "sNo": "21", "empId": "MVSID946", "department": "UCC", "name": "Poonam" },
    { "sNo": "22", "empId": "MVSID869", "department": "UCC", "name": "Krishna Kumar Sharma" },
    { "sNo": "23", "empId": "MVSID889", "department": "UCC", "name": "Sadgi Shrivastava" },
    { "sNo": "24", "empId": "MVSID932", "department": "UCC", "name": "Praveen" },
    { "sNo": "25", "empId": "MVSID868", "department": "UCC", "name": "Bharti Suryavanshi" },
    { "sNo": "26", "empId": "MVSID881", "department": "UCC", "name": "Yogesh Sharma" },
    { "sNo": "27", "empId": "MVSID935", "department": "UCC", "name": "Savita Sharma" },
    { "sNo": "28", "empId": "MVSID939", "department": "UCC", "name": "Ashwani Kumar" },
    { "sNo": "29", "empId": "MVSID945", "department": "UCC", "name": "Happy Singh" },
    { "sNo": "30", "empId": "MVSID1192", "department": "UCC", "name": "Renu" },
    { "sNo": "31", "empId": "MVSID863", "department": "UCC", "name": "Poonam Chauhan" },
    { "sNo": "32", "empId": "MVSID874", "department": "UCC", "name": "Lucky Awasthi" },
    { "sNo": "33", "empId": "MVSID867", "department": "UCC", "name": "Nikita Saini" },
    { "sNo": "34", "empId": "MVSID877", "department": "UCC", "name": "Sandeep Kumar" },
    { "sNo": "35", "empId": "MVSID954", "department": "UCC", "name": "Ankush Kumar" },
    { "sNo": "36", "empId": "MVSID884", "department": "UCC", "name": "Kuldeep" },
    { "sNo": "37", "empId": "MVSID941", "department": "UCC", "name": "Vipin Kumar" },
    { "sNo": "38", "empId": "MVSID1713", "department": "UCC", "name": "Vikash Singh" },
    { "sNo": "39", "empId": "MVSID1951", "department": "UCC", "name": "Sushil Kumar" },
    { "sNo": "40", "empId": "MVSID1697", "department": "UCC", "name": "Ravikumar" },
    { "sNo": "41", "empId": "MVSID2051", "department": "UCC", "name": "Devesh" },
    { "sNo": "42", "empId": "MVSID1694", "department": "UCC", "name": "Babita Bhardwaj" },
    { "sNo": "43", "empId": "MVSID1868", "department": "UCC", "name": "Varsha Chauhan" },
    { "sNo": "44", "empId": "MVSID924", "department": "UCC", "name": "Hariom" },
    { "sNo": "45", "empId": "MVSID928", "department": "UCC", "name": "Adarsh Singh" },
    { "sNo": "46", "empId": "MVSID944", "department": "UCC", "name": "Gajendra Chaudhary" },
    { "sNo": "47", "empId": "MVSID902", "department": "UCC", "name": "Rashmi" },
    { "sNo": "48", "empId": "MVSID879", "department": "UCC", "name": "Manju Sharma" },
    { "sNo": "49", "empId": "MVSID930", "department": "UCC", "name": "Akshat Gupta" },
    { "sNo": "50", "empId": "MVSID916", "department": "UCC", "name": "Manish" },
    { "sNo": "51", "empId": "MVSID929", "department": "UCC", "name": "Manvendra" },
    { "sNo": "52", "empId": "MVSID870", "department": "UCC", "name": "Basant Kaushik" },
    { "sNo": "53", "empId": "MVSID936", "department": "UCC", "name": "Sachin Gauhar" },
    { "sNo": "54", "empId": "MVSID940", "department": "UCC", "name": "Vipin Kumar Vrindavan" },
    { "sNo": "55", "empId": "MVSID875", "department": "UCC", "name": "Preety Sharma" },
    { "sNo": "56", "empId": "MVSID1624", "department": "C&T", "name": "ANKIT" },
    { "sNo": "57", "empId": "MVSID1625", "department": "C&T", "name": "VEERESH" },
    { "sNo": "58", "empId": "MVSID1627", "department": "C&T", "name": "SONVEER" },
    { "sNo": "59", "empId": "MVSID1626", "department": "C&T", "name": "VIKASH" },
    { "sNo": "60", "empId": "MVSID1623", "department": "C&T", "name": "SACHIN" },
    { "sNo": "61", "empId": "MVSID1629", "department": "C&T", "name": "GAURAV" },
    { "sNo": "62", "empId": "MVSID1628", "department": "C&T", "name": "HARIOM" },
    { "sNo": "63", "empId": "MVSID1638", "department": "C&T", "name": "MAHAVEER" },
    { "sNo": "64", "empId": "MVSID1692", "department": "C&T", "name": "ANSHU" },
    { "sNo": "65", "empId": "MVSID1636", "department": "C&T", "name": "SUDESH" },
    { "sNo": "66", "empId": "MVSID1637", "department": "C&T", "name": "SUBHASH" },
    { "sNo": "67", "empId": "MVSID1635", "department": "C&T", "name": "NARESH" },
    { "sNo": "68", "empId": "MVSID1639", "department": "C&T", "name": "JITENDRA" },
    { "sNo": "69", "empId": "MVSID1641", "department": "C&T", "name": "AMAN YADAV" },
    { "sNo": "70", "empId": "MVSID1631", "department": "C&T", "name": "ANIL BAGHEL" },
    { "sNo": "71", "empId": "MVSID1632", "department": "C&T", "name": "DILIP" },
    { "sNo": "72", "empId": "MVSID1633", "department": "C&T", "name": "AMAN CHAU." },
    { "sNo": "73", "empId": "MVSID1640", "department": "C&T", "name": "DEEPAK" },
    { "sNo": "74", "empId": "MVSID1695", "department": "C&T", "name": "MOHIT" },
    { "sNo": "75", "empId": "MVSID1644", "department": "C&T", "name": "ADIL MALIK" },
    { "sNo": "76", "empId": "MVSID1646", "department": "C&T", "name": "ARJUN" },
    { "sNo": "77", "empId": "MVSID1648", "department": "C&T", "name": "ARYAN" },
    { "sNo": "78", "empId": "MVSID1649", "department": "C&T", "name": "ANIL RANA" },
    { "sNo": "79", "empId": "MVSID1689", "department": "C&T", "name": "SANJEEV" },
    { "sNo": "80", "empId": "MVSID1700", "department": "C&T", "name": "CHARAN SINGH" },
    { "sNo": "81", "empId": "MVSID1650", "department": "C&T", "name": "HARIKESH" },
    { "sNo": "82", "empId": "MVSID1647", "department": "C&T", "name": "SURENDRA" },
    { "sNo": "83", "empId": "MVSID1655", "department": "C&T", "name": "SATISH" },
    { "sNo": "84", "empId": "MVSID1656", "department": "C&T", "name": "VISHNU" },
    { "sNo": "85", "empId": "MVSID1660", "department": "C&T", "name": "PRIYANSHU" },
    { "sNo": "86", "empId": "MVSID1852", "department": "C&T", "name": "MANOJ" },
    { "sNo": "87", "empId": "MVSID1653", "department": "C&T", "name": "SATENDRA" },
    { "sNo": "88", "empId": "MVSID1657", "department": "C&T", "name": "PAVAN" },
    { "sNo": "89", "empId": "MVSID1651", "department": "C&T", "name": "HEMANT" },
    { "sNo": "90", "empId": "MVSID1659", "department": "C&T", "name": "MOHIT" },
    { "sNo": "91", "empId": "MVSID1693", "department": "C&T", "name": "Nikhil kumar" },
    { "sNo": "92", "empId": "MVSID3296", "department": "UCC", "name": "rohit kumar" }
]

master_ids = set(s['empId'].strip() for s in MASTER_SUPERVISORS)
csv_ids = set(s['empId'] for s in csv_supervisors)

print("-" * 50)
print("Supervisors in CSV but NOT in MASTER:")
for s in csv_supervisors:
    if s['empId'] not in master_ids:
        print(f"{s['empId']} - {s['name']}")

print("\n" + "-" * 50)
print("Supervisors in MASTER (UCC Only) but NOT in CSV:")
for s in MASTER_SUPERVISORS:
    if s['department'] == 'UCC' and s['empId'].strip() not in csv_ids:
        print(f"{s['empId']} - {s['name']} ({s['department']})")

print("\n" + "-" * 50)
print("Supervisors in MASTER (ALL) but NOT in CSV:")
for s in MASTER_SUPERVISORS:
    if s['empId'].strip() not in csv_ids:
        print(f"{s['empId']} - {s['name']} ({s['department']})")
