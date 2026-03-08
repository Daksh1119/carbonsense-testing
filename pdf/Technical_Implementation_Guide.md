# Technical Implementation Guide
## CarbonSense AI Platform - Deep Dive

---

## 1. DETAILED CODE ARCHITECTURE

### 1.1 Project Structure

```
carbonsense-ai/
├── packages/
│   ├── frontend/              # React web application
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── auth/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── analytics/
│   │   │   │   ├── ocr/
│   │   │   │   └── shared/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   ├── store/         # Redux
│   │   │   ├── utils/
│   │   │   └── App.tsx
│   │   ├── public/
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── backend/               # Node.js microservices
│   │   ├── services/
│   │   │   ├── auth-service/
│   │   │   ├── carbon-service/
│   │   │   ├── analytics-service/
│   │   │   ├── ocr-service/
│   │   │   ├── notification-service/
│   │   │   └── blockchain-service/
│   │   ├── shared/            # Shared utilities
│   │   │   ├── database/
│   │   │   ├── middleware/
│   │   │   ├── utils/
│   │   │   └── types/
│   │   └── api-gateway/
│   │
│   ├── ml-services/           # Python ML microservices
│   │   ├── ocr-service/
│   │   │   ├── models/
│   │   │   ├── preprocessing/
│   │   │   ├── api/
│   │   │   └── Dockerfile
│   │   ├── food-recognition/
│   │   ├── nlp-service/
│   │   ├── timeseries-service/
│   │   ├── rl-agent/
│   │   └── xai-service/
│   │
│   ├── mobile/                # React Native app
│   │   └── (Semester 2)
│   │
│   └── blockchain/            # Smart contracts
│       ├── contracts/
│       ├── migrations/
│       └── tests/
│
├── infrastructure/
│   ├── docker/
│   │   ├── docker-compose.yml
│   │   └── Dockerfile.*
│   ├── kubernetes/
│   │   ├── deployments/
│   │   ├── services/
│   │   └── configmaps/
│   ├── terraform/             # IaC
│   └── monitoring/
│       ├── prometheus/
│       └── grafana/
│
├── data/
│   ├── raw/
│   ├── processed/
│   ├── models/
│   └── datasets/
│
├── docs/
│   ├── api/
│   ├── architecture/
│   └── user-guides/
│
├── scripts/
│   ├── setup.sh
│   ├── deploy.sh
│   └── seed-data.py
│
└── tests/
    ├── e2e/
    ├── integration/
    └── load/
```

---

## 2. DETAILED ML MODEL IMPLEMENTATIONS

### 2.1 Receipt OCR Pipeline (Complete Implementation)

#### A. Model Architecture

```python
# ocr-service/models/ocr_model.py

import torch
import torch.nn as nn
from transformers import TrOCRProcessor, VisionEncoderDecoderModel
from PIL import Image
import numpy as np

class ReceiptOCRModel:
    def __init__(self, model_name='microsoft/trocr-base-printed'):
        self.processor = TrOCRProcessor.from_pretrained(model_name)
        self.model = VisionEncoderDecoderModel.from_pretrained(model_name)
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model.to(self.device)
        self.model.eval()
    
    def preprocess_image(self, image_path):
        """
        Preprocess receipt image for OCR
        """
        from PIL import Image, ImageEnhance
        import cv2
        
        # Read image
        img = cv2.imread(image_path)
        
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Noise removal
        denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
        
        # Adaptive thresholding
        thresh = cv2.adaptiveThreshold(
            denoised, 255, 
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY, 11, 2
        )
        
        # Deskew (if needed)
        coords = np.column_stack(np.where(thresh > 0))
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
        (h, w) = thresh.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(
            thresh, M, (w, h),
            flags=cv2.INTER_CUBIC, 
            borderMode=cv2.BORDER_REPLICATE
        )
        
        return Image.fromarray(rotated)
    
    def extract_text(self, image_path):
        """
        Extract text from receipt image
        """
        # Preprocess
        image = self.preprocess_image(image_path)
        
        # TrOCR inference
        pixel_values = self.processor(image, return_tensors="pt").pixel_values
        pixel_values = pixel_values.to(self.device)
        
        with torch.no_grad():
            generated_ids = self.model.generate(pixel_values)
        
        generated_text = self.processor.batch_decode(
            generated_ids, skip_special_tokens=True
        )[0]
        
        return generated_text
    
    def post_process(self, text):
        """
        Clean and structure extracted text
        """
        # Remove extra whitespace
        text = ' '.join(text.split())
        
        # Remove special characters
        import re
        text = re.sub(r'[^\w\s\.\,\-\:\₹\$]', '', text)
        
        return text


class InformationExtractor:
    """
    Extract structured information from OCR text using NER
    """
    def __init__(self):
        from transformers import AutoTokenizer, AutoModelForTokenClassification
        from transformers import pipeline
        
        # Use LayoutLM or custom-trained NER model
        self.tokenizer = AutoTokenizer.from_pretrained(
            "bert-base-uncased"
        )
        self.model = AutoModelForTokenClassification.from_pretrained(
            "./models/receipt-ner"  # Custom trained
        )
        self.ner_pipeline = pipeline(
            "ner", 
            model=self.model, 
            tokenizer=self.tokenizer,
            aggregation_strategy="simple"
        )
    
    def extract_entities(self, text):
        """
        Extract vendor, items, prices, dates
        """
        entities = self.ner_pipeline(text)
        
        structured_data = {
            'vendor': None,
            'items': [],
            'total': None,
            'date': None
        }
        
        for entity in entities:
            if entity['entity_group'] == 'VENDOR':
                structured_data['vendor'] = entity['word']
            elif entity['entity_group'] == 'ITEM':
                structured_data['items'].append({
                    'name': entity['word'],
                    'price': None  # Extract separately
                })
            elif entity['entity_group'] == 'TOTAL':
                structured_data['total'] = self._parse_price(entity['word'])
            elif entity['entity_group'] == 'DATE':
                structured_data['date'] = self._parse_date(entity['word'])
        
        return structured_data
    
    def _parse_price(self, price_str):
        import re
        # Extract numeric value
        match = re.search(r'[\d,]+\.?\d*', price_str)
        if match:
            return float(match.group().replace(',', ''))
        return None
    
    def _parse_date(self, date_str):
        from dateutil import parser
        try:
            return parser.parse(date_str).isoformat()
        except:
            return None


class CarbonMapper:
    """
    Map extracted items to carbon footprint
    """
    def __init__(self, db_connection):
        self.db = db_connection
    
    def get_carbon_footprint(self, items, vendor=None):
        """
        Calculate carbon footprint for purchased items
        """
        total_carbon = 0
        detailed_items = []
        
        for item in items:
            # Fuzzy match item to product database
            carbon_data = self._fuzzy_match_product(item['name'])
            
            if carbon_data:
                item_carbon = carbon_data['carbon_per_unit'] * item.get('quantity', 1)
                total_carbon += item_carbon
                
                detailed_items.append({
                    **item,
                    'carbon_kg': item_carbon,
                    'category': carbon_data['category'],
                    'confidence': carbon_data['match_score']
                })
            else:
                # Use category-level estimation
                category = self._classify_item(item['name'])
                avg_carbon = self._get_category_average(category)
                
                detailed_items.append({
                    **item,
                    'carbon_kg': avg_carbon,
                    'category': category,
                    'confidence': 0.5
                })
                total_carbon += avg_carbon
        
        return {
            'total_carbon_kg': total_carbon,
            'items': detailed_items
        }
    
    def _fuzzy_match_product(self, item_name):
        from fuzzywuzzy import fuzz
        
        # Query product database
        products = self.db.query(
            "SELECT * FROM products WHERE name ILIKE %s",
            (f'%{item_name}%',)
        )
        
        if not products:
            return None
        
        # Find best match
        best_match = max(
            products, 
            key=lambda p: fuzz.ratio(item_name.lower(), p['name'].lower())
        )
        
        match_score = fuzz.ratio(item_name.lower(), best_match['name'].lower()) / 100
        
        if match_score > 0.7:
            return {
                **best_match,
                'match_score': match_score
            }
        
        return None
    
    def _classify_item(self, item_name):
        # Use NLP classifier to categorize
        # Categories: food, electronics, clothing, etc.
        # For now, simplified version
        
        food_keywords = ['rice', 'bread', 'milk', 'chicken', 'vegetables']
        electronics_keywords = ['phone', 'laptop', 'charger', 'cable']
        
        item_lower = item_name.lower()
        
        if any(kw in item_lower for kw in food_keywords):
            return 'food'
        elif any(kw in item_lower for kw in electronics_keywords):
            return 'electronics'
        else:
            return 'other'
    
    def _get_category_average(self, category):
        averages = {
            'food': 2.5,
            'electronics': 15.0,
            'clothing': 8.0,
            'other': 5.0
        }
        return averages.get(category, 5.0)


# FastAPI endpoint
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
import uuid
import os

app = FastAPI()

ocr_model = ReceiptOCRModel()
extractor = InformationExtractor()
# carbon_mapper = CarbonMapper(db_connection)  # Initialize with DB

@app.post("/api/ocr/process-receipt")
async def process_receipt(file: UploadFile = File(...)):
    """
    Process uploaded receipt image
    """
    try:
        # Save uploaded file
        file_id = str(uuid.uuid4())
        file_path = f"/tmp/{file_id}_{file.filename}"
        
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Step 1: OCR
        ocr_text = ocr_model.extract_text(file_path)
        cleaned_text = ocr_model.post_process(ocr_text)
        
        # Step 2: Information Extraction
        structured_data = extractor.extract_entities(cleaned_text)
        
        # Step 3: Carbon Mapping
        # carbon_result = carbon_mapper.get_carbon_footprint(
        #     structured_data['items'],
        #     structured_data['vendor']
        # )
        
        # Clean up
        os.remove(file_path)
        
        return JSONResponse({
            'success': True,
            'receipt_id': file_id,
            'ocr_text': cleaned_text,
            'structured_data': structured_data,
            # 'carbon_footprint': carbon_result
        })
    
    except Exception as e:
        return JSONResponse({
            'success': False,
            'error': str(e)
        }, status_code=500)
```

#### B. Training Custom NER Model

```python
# scripts/train_receipt_ner.py

import torch
from torch.utils.data import Dataset, DataLoader
from transformers import (
    AutoTokenizer, 
    AutoModelForTokenClassification,
    TrainingArguments, 
    Trainer
)
from datasets import load_dataset
import numpy as np

class ReceiptNERDataset(Dataset):
    def __init__(self, data, tokenizer, max_len=512):
        self.data = data
        self.tokenizer = tokenizer
        self.max_len = max_len
        
        # Label mapping
        self.label2id = {
            'O': 0,
            'B-VENDOR': 1,
            'I-VENDOR': 2,
            'B-ITEM': 3,
            'I-ITEM': 4,
            'B-PRICE': 5,
            'I-PRICE': 6,
            'B-DATE': 7,
            'I-DATE': 8,
            'B-TOTAL': 9,
            'I-TOTAL': 10
        }
        self.id2label = {v: k for k, v in self.label2id.items()}
    
    def __len__(self):
        return len(self.data)
    
    def __getitem__(self, idx):
        item = self.data[idx]
        
        tokens = item['tokens']
        labels = item['ner_tags']
        
        # Tokenize
        encoding = self.tokenizer(
            tokens,
            is_split_into_words=True,
            padding='max_length',
            truncation=True,
            max_length=self.max_len,
            return_tensors='pt'
        )
        
        # Align labels with tokenized input
        word_ids = encoding.word_ids()
        aligned_labels = []
        
        for word_id in word_ids:
            if word_id is None:
                aligned_labels.append(-100)  # Ignore
            else:
                aligned_labels.append(labels[word_id])
        
        encoding['labels'] = torch.tensor(aligned_labels)
        
        return {
            'input_ids': encoding['input_ids'].squeeze(),
            'attention_mask': encoding['attention_mask'].squeeze(),
            'labels': encoding['labels']
        }


def train_ner_model():
    # Load data (you need to create this dataset)
    # Format: [{'tokens': [...], 'ner_tags': [...]}, ...]
    
    # For demonstration, using a dummy dataset structure
    train_data = load_custom_receipt_dataset('train')
    val_data = load_custom_receipt_dataset('val')
    
    # Initialize tokenizer and model
    tokenizer = AutoTokenizer.from_pretrained('bert-base-uncased')
    model = AutoModelForTokenClassification.from_pretrained(
        'bert-base-uncased',
        num_labels=11  # Number of NER tags
    )
    
    # Create datasets
    train_dataset = ReceiptNERDataset(train_data, tokenizer)
    val_dataset = ReceiptNERDataset(val_data, tokenizer)
    
    # Training arguments
    training_args = TrainingArguments(
        output_dir='./models/receipt-ner',
        num_train_epochs=10,
        per_device_train_batch_size=16,
        per_device_eval_batch_size=32,
        warmup_steps=500,
        weight_decay=0.01,
        logging_dir='./logs',
        logging_steps=100,
        evaluation_strategy='epoch',
        save_strategy='epoch',
        load_best_model_at_end=True,
        metric_for_best_model='f1',
    )
    
    # Metrics
    def compute_metrics(eval_pred):
        from seqeval.metrics import f1_score, precision_score, recall_score
        
        predictions, labels = eval_pred
        predictions = np.argmax(predictions, axis=2)
        
        # Remove ignored index (special tokens)
        true_labels = [[train_dataset.id2label[l] for l in label if l != -100] 
                       for label in labels]
        true_predictions = [[train_dataset.id2label[p] for (p, l) in zip(prediction, label) if l != -100]
                           for prediction, label in zip(predictions, labels)]
        
        return {
            'precision': precision_score(true_labels, true_predictions),
            'recall': recall_score(true_labels, true_predictions),
            'f1': f1_score(true_labels, true_predictions),
        }
    
    # Trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        compute_metrics=compute_metrics,
    )
    
    # Train
    trainer.train()
    
    # Save
    trainer.save_model('./models/receipt-ner')
    tokenizer.save_pretrained('./models/receipt-ner')


def load_custom_receipt_dataset(split):
    # Load your annotated receipt data
    # This is a placeholder - you need to create this dataset
    
    # Example format:
    # {
    #     'tokens': ['Walmart', 'Milk', '₹', '50', 'Total', '₹', '50'],
    #     'ner_tags': [1, 3, 5, 5, 9, 9, 9]  # Using label2id mapping
    # }
    
    pass  # Implement based on your data


if __name__ == '__main__':
    train_ner_model()
```

---

### 2.2 Food Image Recognition (Complete Implementation)

```python
# food-recognition/models/food_classifier.py

import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import json

class FoodRecognitionModel:
    def __init__(self, model_path='./models/food_recognition.pth', num_classes=101):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Load EfficientNet-B4
        self.model = models.efficientnet_b4(pretrained=False)
        
        # Modify final layer
        num_ftrs = self.model.classifier[1].in_features
        self.model.classifier[1] = nn.Linear(num_ftrs, num_classes)
        
        # Load trained weights
        if model_path:
            self.model.load_state_dict(torch.load(model_path, map_location=self.device))
        
        self.model.to(self.device)
        self.model.eval()
        
        # Load class mapping
        with open('./models/food_classes.json', 'r') as f:
            self.class_names = json.load(f)
        
        # Load carbon database
        with open('./data/food_carbon_db.json', 'r') as f:
            self.carbon_db = json.load(f)
        
        # Define transforms
        self.transform = transforms.Compose([
            transforms.Resize((380, 380)),
            transforms.CenterCrop(380),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])
    
    def predict(self, image_path, top_k=5):
        """
        Predict food items from image
        """
        # Load and preprocess image
        image = Image.open(image_path).convert('RGB')
        input_tensor = self.transform(image).unsqueeze(0).to(self.device)
        
        # Inference
        with torch.no_grad():
            outputs = self.model(input_tensor)
            probabilities = torch.nn.functional.softmax(outputs, dim=1)
        
        # Get top-k predictions
        top_probs, top_indices = torch.topk(probabilities, top_k)
        
        predictions = []
        for prob, idx in zip(top_probs[0], top_indices[0]):
            food_name = self.class_names[idx.item()]
            carbon_data = self.carbon_db.get(food_name, {})
            
            predictions.append({
                'food_name': food_name,
                'confidence': prob.item(),
                'carbon_per_100g': carbon_data.get('carbon_kg_per_100g', 0),
                'category': carbon_data.get('category', 'unknown')
            })
        
        return predictions
    
    def estimate_portion_size(self, image_path):
        """
        Estimate portion size using object detection
        (Simplified - can be enhanced with actual portion detection)
        """
        # Placeholder: In reality, use object detection to estimate size
        # Could use depth estimation, reference objects, etc.
        
        # For now, return average portion
        return 200  # grams
    
    def calculate_carbon(self, predictions, portion_grams=200):
        """
        Calculate total carbon footprint
        """
        # Use top prediction
        top_prediction = predictions[0]
        
        carbon_per_100g = top_prediction['carbon_per_100g']
        total_carbon = (portion_grams / 100) * carbon_per_100g
        
        return {
            'food': top_prediction['food_name'],
            'portion_grams': portion_grams,
            'carbon_kg': total_carbon,
            'confidence': top_prediction['confidence'],
            'alternatives': self._get_low_carbon_alternatives(
                top_prediction['category']
            )
        }
    
    def _get_low_carbon_alternatives(self, category):
        """
        Suggest lower carbon alternatives in same category
        """
        alternatives_db = {
            'meat': ['tofu', 'lentils', 'chickpeas'],
            'dairy': ['oat milk', 'almond milk'],
            'grains': ['quinoa', 'brown rice']
        }
        
        return alternatives_db.get(category, [])


# Training script
def train_food_model():
    import torchvision.datasets as datasets
    from torch.utils.data import DataLoader
    from torch.optim import Adam
    from torch.optim.lr_scheduler import ReduceLROnPlateau
    
    # Hyperparameters
    num_epochs = 50
    batch_size = 32
    learning_rate = 0.001
    num_classes = 101
    
    # Data augmentation for training
    train_transform = transforms.Compose([
        transforms.RandomResizedCrop(380),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                           std=[0.229, 0.224, 0.225])
    ])
    
    val_transform = transforms.Compose([
        transforms.Resize((380, 380)),
        transforms.CenterCrop(380),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406],
                           std=[0.229, 0.224, 0.225])
    ])
    
    # Load Food-101 dataset
    train_dataset = datasets.Food101(
        root='./data',
        split='train',
        transform=train_transform,
        download=True
    )
    
    val_dataset = datasets.Food101(
        root='./data',
        split='test',
        transform=val_transform,
        download=True
    )
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=4)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=4)
    
    # Model
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = models.efficientnet_b4(pretrained=True)
    
    # Modify final layer
    num_ftrs = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(num_ftrs, num_classes)
    model.to(device)
    
    # Loss and optimizer
    criterion = nn.CrossEntropyLoss()
    optimizer = Adam(model.parameters(), lr=learning_rate)
    scheduler = ReduceLROnPlateau(optimizer, mode='max', factor=0.5, patience=3, verbose=True)
    
    # Training loop
    best_acc = 0.0
    
    for epoch in range(num_epochs):
        # Training phase
        model.train()
        train_loss = 0.0
        train_correct = 0
        train_total = 0
        
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item()
            _, predicted = outputs.max(1)
            train_total += labels.size(0)
            train_correct += predicted.eq(labels).sum().item()
        
        train_acc = 100. * train_correct / train_total
        
        # Validation phase
        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0
        
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                
                outputs = model(images)
                loss = criterion(outputs, labels)
                
                val_loss += loss.item()
                _, predicted = outputs.max(1)
                val_total += labels.size(0)
                val_correct += predicted.eq(labels).sum().item()
        
        val_acc = 100. * val_correct / val_total
        
        print(f'Epoch [{epoch+1}/{num_epochs}]')
        print(f'Train Loss: {train_loss/len(train_loader):.4f}, Train Acc: {train_acc:.2f}%')
        print(f'Val Loss: {val_loss/len(val_loader):.4f}, Val Acc: {val_acc:.2f}%')
        
        # Learning rate scheduling
        scheduler.step(val_acc)
        
        # Save best model
        if val_acc > best_acc:
            best_acc = val_acc
            torch.save(model.state_dict(), './models/food_recognition_best.pth')
            print(f'Best model saved with accuracy: {best_acc:.2f}%')
    
    print(f'Training completed. Best validation accuracy: {best_acc:.2f}%')


# FastAPI endpoint
from fastapi import FastAPI, UploadFile, File

app = FastAPI()
food_model = FoodRecognitionModel()

@app.post("/api/food/recognize")
async def recognize_food(file: UploadFile = File(...)):
    """
    Recognize food from image and calculate carbon footprint
    """
    try:
        # Save uploaded file
        file_path = f"/tmp/{file.filename}"
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Predict
        predictions = food_model.predict(file_path, top_k=5)
        
        # Estimate portion
        portion = food_model.estimate_portion_size(file_path)
        
        # Calculate carbon
        carbon_result = food_model.calculate_carbon(predictions, portion)
        
        # Clean up
        os.remove(file_path)
        
        return {
            'success': True,
            'predictions': predictions,
            'carbon_footprint': carbon_result
        }
    
    except Exception as e:
        return {'success': False, 'error': str(e)}
```

---

### 2.3 Time-Series Forecasting (Prophet + TFT Ensemble)

```python
# timeseries-service/models/forecasting.py

import pandas as pd
import numpy as np
from prophet import Prophet
from pytorch_forecasting import TimeSeriesDataSet, TemporalFusionTransformer
from pytorch_forecasting.metrics import QuantileLoss
import torch
from torch.utils.data import DataLoader
import warnings
warnings.filterwarnings('ignore')

class CarbonForecaster:
    def __init__(self):
        self.prophet_model = None
        self.tft_model = None
        self.ensemble_weights = {'prophet': 0.4, 'tft': 0.6}
    
    def prepare_data(self, carbon_df):
        """
        Prepare time-series data for forecasting
        
        Expected format:
        carbon_df = pd.DataFrame({
            'ds': [dates],
            'y': [carbon_values],
            'category': [transport/energy/food/etc]
        })
        """
        carbon_df = carbon_df.copy()
        carbon_df['ds'] = pd.to_datetime(carbon_df['ds'])
        carbon_df = carbon_df.sort_values('ds')
        
        return carbon_df
    
    def train_prophet(self, carbon_df):
        """
        Train Prophet model
        """
        # Initialize Prophet with custom parameters
        self.prophet_model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            seasonality_mode='multiplicative',
            changepoint_prior_scale=0.05,
            interval_width=0.95
        )
        
        # Add custom seasonalities
        self.prophet_model.add_seasonality(
            name='monthly',
            period=30.5,
            fourier_order=5
        )
        
        # Fit model
        self.prophet_model.fit(carbon_df[['ds', 'y']])
        
        return self
    
    def train_tft(self, carbon_df, max_encoder_length=90, max_prediction_length=30):
        """
        Train Temporal Fusion Transformer
        """
        # Prepare data for TFT
        carbon_df = carbon_df.copy()
        carbon_df['time_idx'] = (carbon_df['ds'] - carbon_df['ds'].min()).dt.days
        carbon_df['group'] = 'carbon'  # Single time series
        
        # Create TimeSeriesDataSet
        training = TimeSeriesDataSet(
            carbon_df,
            time_idx='time_idx',
            target='y',
            group_ids=['group'],
            max_encoder_length=max_encoder_length,
            max_prediction_length=max_prediction_length,
            time_varying_known_reals=['time_idx'],
            time_varying_unknown_reals=['y'],
            add_relative_time_idx=True,
            add_target_scales=True,
            add_encoder_length=True,
        )
        
        # Create dataloader
        train_dataloader = training.to_dataloader(train=True, batch_size=64, num_workers=0)
        
        # Initialize TFT
        self.tft_model = TemporalFusionTransformer.from_dataset(
            training,
            learning_rate=0.03,
            hidden_size=32,
            attention_head_size=1,
            dropout=0.1,
            hidden_continuous_size=16,
            loss=QuantileLoss(),
            log_interval=10,
            reduce_on_plateau_patience=4,
        )
        
        # Train
        from pytorch_lightning import Trainer
        trainer = Trainer(
            max_epochs=50,
            accelerator='auto',
            gradient_clip_val=0.1,
        )
        
        trainer.fit(
            self.tft_model,
            train_dataloaders=train_dataloader,
        )
        
        return self
    
    def predict_prophet(self, periods=30):
        """
        Generate predictions using Prophet
        """
        if self.prophet_model is None:
            raise ValueError("Prophet model not trained yet")
        
        # Create future dataframe
        future = self.prophet_model.make_future_dataframe(periods=periods)
        
        # Predict
        forecast = self.prophet_model.predict(future)
        
        return forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(periods)
    
    def predict_tft(self, carbon_df, periods=30):
        """
        Generate predictions using TFT
        """
        if self.tft_model is None:
            raise ValueError("TFT model not trained yet")
        
        # Prepare data (last max_encoder_length days)
        carbon_df = carbon_df.copy()
        carbon_df['time_idx'] = (carbon_df['ds'] - carbon_df['ds'].min()).dt.days
        carbon_df['group'] = 'carbon'
        
        # Get last available data
        encoder_data = carbon_df.iloc[-90:]  # Assuming max_encoder_length=90
        
        # Create prediction dataset
        # (Implementation depends on pytorch_forecasting version)
        # Placeholder for actual prediction logic
        
        predictions = []
        # Generate predictions for 'periods' days
        
        return predictions
    
    def ensemble_predict(self, carbon_df, periods=30):
        """
        Ensemble predictions from Prophet and TFT
        """
        # Prophet predictions
        prophet_pred = self.predict_prophet(periods)
        
        # TFT predictions
        # tft_pred = self.predict_tft(carbon_df, periods)
        
        # Weighted average (for now, just use Prophet)
        # In production, implement proper ensemble
        
        final_predictions = []
        for idx, row in prophet_pred.iterrows():
            final_predictions.append({
                'date': row['ds'].strftime('%Y-%m-%d'),
                'predicted_carbon_kg': row['yhat'],
                'lower_bound': row['yhat_lower'],
                'upper_bound': row['yhat_upper'],
                'confidence': 0.95
            })
        
        return final_predictions
    
    def detect_anomalies(self, carbon_df):
        """
        Detect anomalies in carbon footprint
        """
        if self.prophet_model is None:
            raise ValueError("Model not trained yet")
        
        # Predict on historical data
        historical_pred = self.prophet_model.predict(carbon_df[['ds']])
        
        # Calculate residuals
        residuals = carbon_df['y'] - historical_pred['yhat']
        
        # Detect anomalies (values outside 2 std dev)
        threshold = 2 * residuals.std()
        anomalies = carbon_df[abs(residuals) > threshold].copy()
        anomalies['residual'] = residuals[abs(residuals) > threshold]
        
        return anomalies
    
    def scenario_analysis(self, carbon_df, scenarios):
        """
        Perform what-if scenario analysis
        
        scenarios = {
            'switch_to_ev': {'transport': -30},  # 30% reduction in transport
            'vegetarian_diet': {'food': -25},
            'solar_panels': {'energy': -40}
        }
        """
        results = {}
        
        for scenario_name, changes in scenarios.items():
            # Create modified dataframe
            modified_df = carbon_df.copy()
            
            for category, reduction_pct in changes.items():
                mask = modified_df['category'] == category
                modified_df.loc[mask, 'y'] *= (1 + reduction_pct / 100)
            
            # Train Prophet on modified data
            temp_model = Prophet()
            temp_model.fit(modified_df[['ds', 'y']])
            
            # Predict
            future = temp_model.make_future_dataframe(periods=30)
            forecast = temp_model.predict(future)
            
            results[scenario_name] = {
                'current_avg': carbon_df['y'].mean(),
                'projected_avg': forecast['yhat'].tail(30).mean(),
                'reduction_kg': carbon_df['y'].mean() - forecast['yhat'].tail(30).mean(),
                'reduction_pct': ((carbon_df['y'].mean() - forecast['yhat'].tail(30).mean()) / carbon_df['y'].mean()) * 100
            }
        
        return results


# FastAPI endpoint
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Dict

app = FastAPI()

class PredictionRequest(BaseModel):
    user_id: str
    periods: int = 30

@app.post("/api/predict/forecast")
async def forecast_carbon(request: PredictionRequest):
    """
    Generate carbon footprint forecast
    """
    try:
        # Fetch user's historical data from database
        # carbon_df = get_user_carbon_history(request.user_id)
        
        # For demo purposes, using sample data
        dates = pd.date_range(start='2024-01-01', periods=180, freq='D')
        carbon_values = np.random.normal(loc=50, scale=10, size=180) + np.sin(np.arange(180) * 2 * np.pi / 30) * 5
        
        carbon_df = pd.DataFrame({
            'ds': dates,
            'y': carbon_values,
            'category': ['energy'] * 180
        })
        
        # Initialize forecaster
        forecaster = CarbonForecaster()
        
        # Train models
        forecaster.train_prophet(carbon_df)
        
        # Generate predictions
        predictions = forecaster.ensemble_predict(carbon_df, periods=request.periods)
        
        # Detect anomalies
        anomalies = forecaster.detect_anomalies(carbon_df)
        
        return {
            'success': True,
            'predictions': predictions,
            'anomalies': anomalies.to_dict('records'),
            'current_avg': float(carbon_df['y'].mean())
        }
    
    except Exception as e:
        return {'success': False, 'error': str(e)}


@app.post("/api/predict/scenario")
async def scenario_analysis(user_id: str, scenarios: Dict[str, Dict[str, float]]):
    """
    Perform scenario analysis
    """
    try:
        # Fetch historical data
        # carbon_df = get_user_carbon_history(user_id)
        
        # Demo data
        dates = pd.date_range(start='2024-01-01', periods=180, freq='D')
        categories = ['transport', 'energy', 'food'] * 60
        carbon_values = np.random.normal(loc=50, scale=10, size=180)
        
        carbon_df = pd.DataFrame({
            'ds': dates,
            'y': carbon_values,
            'category': categories
        })
        
        forecaster = CarbonForecaster()
        forecaster.train_prophet(carbon_df)
        
        results = forecaster.scenario_analysis(carbon_df, scenarios)
        
        return {
            'success': True,
            'scenarios': results
        }
    
    except Exception as e:
        return {'success': False, 'error': str(e)}
```

---

This is getting quite lengthy. Let me continue with the remaining critical components in the output directory.
