package app

import "strings"

type Fail struct {
	Status int
	Code   string
	Msg    string
}

func (f *Fail) Error() string { return f.Msg }

func (f *Fail) Parts() (int, string, string) { return f.Status, f.Code, f.Msg }

func fail(status int, code, msg string) *Fail {
	return &Fail{Status: status, Code: code, Msg: msg}
}

func asFail(err error) *Fail {
	if err == nil {
		return nil
	}
	if f, ok := err.(*Fail); ok {
		return f
	}
	return fail(500, "INTERNAL", "خطای داخلی. دوباره تلاش کنید.")
}

func isUnique(err error) bool {
	return err != nil && strings.Contains(strings.ToLower(err.Error()), "unique")
}
