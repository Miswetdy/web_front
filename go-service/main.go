package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"
)

const AUTH_TOKEN = "secret8b"

var DJANGO_CALLBACK_URL = "http://localhost:8000/api/orders/result_callback/"
var DJANGO_API_URL = "http://localhost:8000"

type CalculateRequest struct {
	OrderID int `json:"order_id"`
}

type UpdateResultRequest struct {
	OrderID   int    `json:"order_id"`
	YearFrom  *int   `json:"year_from"`
	YearTo    *int   `json:"year_to"`
	SecretKey string `json:"secret_key"`
}

type UpdateResultResponse struct {
	OrderID int    `json:"order_id"`
	Status  string `json:"status"`
	Message string `json:"message"`
}

type OrderDataResponse struct {
	OrderID     int         `json:"order_id"`
	HistoryText string      `json:"history_text"`
	Items       []OrderItem `json:"items"`
}

type OrderItem struct {
	PersonID       int     `json:"person_id"`
	PersonName     string  `json:"person_name"`
	YearFrom       int     `json:"year_from"`
	YearTo         int     `json:"year_to"`
	PercentOfTrust float64 `json:"percent_of_trust"`
}

type CalculateResponse struct {
	OrderID      int    `json:"order_id"`
	YearFrom     *int   `json:"year_from"`
	YearTo       *int   `json:"year_to"`
	Status       string `json:"status"`
	CalculatedAt string `json:"calculated_at"`
}

type DebugInfo struct {
	ConfirmedPersons []string `json:"confirmed_persons"`
	CalculatedRange  string   `json:"calculated_range"`
	ItemsChecked     int      `json:"items_checked"`
}

func normalizeText(text string) []string {
	text = strings.ToLower(text)
	re := regexp.MustCompile(`[[:punct:]]`)
	text = re.ReplaceAllString(text, " ")
	re = regexp.MustCompile(`\s+`)
	text = re.ReplaceAllString(text, " ")
	text = strings.TrimSpace(text)
	words := strings.Fields(text)
	return words
}

func generateKeyforms(personName string) map[string][]string {
	words := strings.Fields(strings.ToLower(personName))
	keyforms := map[string][]string{
		"full":   []string{},
		"strong": []string{},
		"weak":   []string{},
	}

	if len(words) > 1 {
		keyforms["full"] = append(keyforms["full"], strings.Join(words, " "))
		keyforms["strong"] = append(keyforms["strong"], fmt.Sprintf("%s %s", words[0], words[len(words)-1]))
	}

	if len(words) > 0 {
		keyforms["weak"] = append(keyforms["weak"], words[0])
	}

	return keyforms
}

func isPersonMentioned(personName string, text string, percentOfTrust float64) bool {
	normalizedWords := normalizeText(text)
	textProc := strings.Join(normalizedWords, " ")

	keyforms := generateKeyforms(personName)
	log.Printf("Checking person '%s' in text '%s'", personName, text)
	log.Printf("Normalized text: '%s'", textProc)
	log.Printf("Keyforms: full=%v, strong=%v, weak=%v", keyforms["full"], keyforms["strong"], keyforms["weak"])

	points := 0
	textRemaining := strings.Fields(textProc)

	weights := map[string]int{
		"full":   3,
		"strong": 2,
		"weak":   1,
	}

	for _, level := range []string{"full", "strong", "weak"} {
		weight := weights[level]
		for _, form := range keyforms[level] {
			formWords := strings.Fields(form)
			if len(formWords) == 1 && len(formWords[0]) <= 2 {
				continue
			}
			for i := 0; i <= len(textRemaining)-len(formWords); i++ {
				match := true
				for j := 0; j < len(formWords); j++ {
					if i+j >= len(textRemaining) || textRemaining[i+j] != formWords[j] {
						match = false
						break
					}
				}
				if match {
					points += weight
					for j := 0; j < len(formWords); j++ {
						if i+j < len(textRemaining) {
							textRemaining[i+j] = "_"
						}
					}
				}
			}
		}
	}

	requiredPoints := 1 + int(math.Ceil((1-percentOfTrust)*4))
	result := points >= requiredPoints
	log.Printf("Person '%s': points=%d, required=%d, result=%v", personName, points, requiredPoints, result)
	return result
}

func calculateYear(historyText string, items []OrderItem) (*int, *int) {
	yearFrom, yearTo, _ := calculateYearWithDebug(historyText, items)
	return yearFrom, yearTo
}

func calculateYearWithDebug(historyText string, items []OrderItem) (*int, *int, *DebugInfo) {
	confirmedPersons := []OrderItem{}
	confirmedNames := []string{}

	for _, item := range items {
		mentioned := isPersonMentioned(item.PersonName, historyText, item.PercentOfTrust)
		log.Printf("Person '%s' mentioned: %v (trust: %.2f)", item.PersonName, mentioned, item.PercentOfTrust)
		if mentioned {
			confirmedPersons = append(confirmedPersons, item)
			confirmedNames = append(confirmedNames, item.PersonName)
		}
	}

	log.Printf("Confirmed persons count: %d", len(confirmedPersons))

	debugInfo := &DebugInfo{
		ConfirmedPersons: confirmedNames,
		ItemsChecked:     len(items),
		CalculatedRange:  "none",
	}

	if len(confirmedPersons) == 0 {
		log.Printf("No confirmed persons found, returning nil")
		debugInfo.CalculatedRange = "no confirmed persons"
		return nil, nil, debugInfo
	}

	yearFrom := confirmedPersons[0].YearFrom
	yearTo := confirmedPersons[0].YearTo

	for _, person := range confirmedPersons {
		if person.YearFrom > yearFrom {
			yearFrom = person.YearFrom
		}
		if person.YearTo < yearTo {
			yearTo = person.YearTo
		}
	}

	log.Printf("Calculated year range: %d - %d", yearFrom, yearTo)

	if yearFrom <= yearTo {
		debugInfo.CalculatedRange = fmt.Sprintf("%d - %d", yearFrom, yearTo)
		return &yearFrom, &yearTo, debugInfo
	}

	log.Printf("Invalid year range (from > to), returning nil")
	debugInfo.CalculatedRange = fmt.Sprintf("invalid: %d > %d", yearFrom, yearTo)
	return nil, nil, debugInfo
}

func fetchOrderData(orderID int) (*OrderDataResponse, error) {
	url := fmt.Sprintf("%s/api/orders/%d/for_calculation/", DJANGO_API_URL, orderID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", AUTH_TOKEN)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch order data: status %d", resp.StatusCode)
	}

	var orderData OrderDataResponse
	if err := json.NewDecoder(resp.Body).Decode(&orderData); err != nil {
		return nil, err
	}

	return &orderData, nil
}

func calculateHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	token := r.Header.Get("Authorization")
	if token != AUTH_TOKEN {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req CalculateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.OrderID == 0 {
		http.Error(w, "order_id is required", http.StatusBadRequest)
		return
	}

	orderData, err := fetchOrderData(req.OrderID)
	if err != nil {
		log.Printf("Error fetching order data: %v", err)
		http.Error(w, fmt.Sprintf("Failed to fetch order data: %v", err), http.StatusInternalServerError)
		return
	}

	startTime := time.Now()
	delay := 5 + time.Duration(time.Now().UnixNano()%5000)*time.Millisecond
	time.Sleep(delay)

	yearFrom, yearTo, debugInfo := calculateYearWithDebug(orderData.HistoryText, orderData.Items)

	calculationTime := time.Since(startTime)
	log.Printf("Calculation completed in %v", calculationTime)

	response := CalculateResponse{
		OrderID:      req.OrderID,
		YearFrom:     yearFrom,
		YearTo:       yearTo,
		Status:       "completed",
		CalculatedAt: time.Now().Format(time.RFC3339),
	}

	log.Printf("Order %d: confirmed_persons=%v, calculated_range=%s, items_checked=%d, calculation_time=%v",
		req.OrderID, debugInfo.ConfirmedPersons, debugInfo.CalculatedRange, debugInfo.ItemsChecked, calculationTime)

	go sendCallback(req.OrderID, yearFrom, yearTo)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func sendCallback(orderID int, yearFrom *int, yearTo *int) {
	var yearFromVal interface{} = yearFrom
	var yearToVal interface{} = yearTo
	if yearFrom != nil {
		yearFromVal = *yearFrom
	}
	if yearTo != nil {
		yearToVal = *yearTo
	}

	log.Printf("Sending callback for order %d: year_from=%v, year_to=%v", orderID, yearFromVal, yearToVal)

	callbackData := map[string]interface{}{
		"order_id":  orderID,
		"year_from": yearFrom,
		"year_to":   yearTo,
	}

	jsonData, err := json.Marshal(callbackData)
	if err != nil {
		log.Printf("Error marshaling callback data: %v", err)
		return
	}

	req, err := http.NewRequest("POST", DJANGO_CALLBACK_URL, bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("Error creating callback request: %v", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", AUTH_TOKEN)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Error sending callback: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("Callback returned status %d", resp.StatusCode)
		return
	}

	log.Printf("Callback sent successfully for order %d", orderID)
}

func updateResultHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req UpdateResultRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.SecretKey != AUTH_TOKEN {
		http.Error(w, "Unauthorized: invalid secret_key", http.StatusUnauthorized)
		return
	}

	if req.OrderID == 0 {
		http.Error(w, "order_id is required", http.StatusBadRequest)
		return
	}

	if req.YearFrom == nil && req.YearTo == nil {
		http.Error(w, "year_from or year_to must be provided", http.StatusBadRequest)
		return
	}

	log.Printf("Update result request received for order %d: year_from=%v, year_to=%v", req.OrderID, req.YearFrom, req.YearTo)

	go func() {
		sendCallback(req.OrderID, req.YearFrom, req.YearTo)
	}()

	response := UpdateResultResponse{
		OrderID: req.OrderID,
		Status:  "accepted",
		Message: "Update request accepted and will be processed asynchronously",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func main() {
	if url := os.Getenv("DJANGO_CALLBACK_URL"); url != "" {
		DJANGO_CALLBACK_URL = url
	}
	if url := os.Getenv("DJANGO_API_URL"); url != "" {
		DJANGO_API_URL = url
	}

	http.HandleFunc("/calculate", calculateHandler)
	http.HandleFunc("/update_result", updateResultHandler)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	log.Printf("Go service starting on :%s", port)
	log.Printf("Django API URL: %s", DJANGO_API_URL)
	log.Printf("Django callback URL: %s", DJANGO_CALLBACK_URL)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
